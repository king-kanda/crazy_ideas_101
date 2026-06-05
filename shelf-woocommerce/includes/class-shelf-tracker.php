<?php
/**
 * Shelf Tracker — buffers search, cart, and purchase events then flushes them.
 *
 * @package Shelf_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Shelf_Tracker {

    /** Transient key for buffered search events. */
    const SEARCH_BUFFER   = 'shelf_search_buffer';

    /** Transient key for buffered cart events. */
    const CART_BUFFER     = 'shelf_cart_buffer';

    /** Transient key for cart-abandon detection. */
    const PENDING_CART    = 'shelf_pending_cart';

    /** Transient TTL — 2 hours (plenty of time between flushes). */
    const BUFFER_TTL      = 2 * HOUR_IN_SECONDS;

    /** Pending-cart TTL — 24 hours (detect abandonment next session). */
    const PENDING_CART_TTL = DAY_IN_SECONDS;

    public function __construct() {
        // Register custom cron interval.
        add_filter( 'cron_schedules', [ $this, 'add_cron_interval' ] );

        // Schedule flush if not already scheduled.
        if ( ! wp_next_scheduled( 'shelf_flush_events' ) ) {
            wp_schedule_event( time(), 'shelf_quarter_hour', 'shelf_flush_events' );
        }

        // Event hooks.
        add_action( 'pre_get_posts',                  [ $this, 'capture_search' ] );
        add_action( 'woocommerce_add_to_cart',        [ $this, 'on_add_to_cart' ],       10, 6 );
        add_action( 'woocommerce_cart_item_removed',  [ $this, 'on_remove_from_cart' ],  10, 2 );
        add_action( 'woocommerce_thankyou',           [ $this, 'on_purchase' ] );
        add_action( 'woocommerce_cart_loaded_from_session', [ $this, 'check_cart_abandon' ] );
        add_action( 'shelf_flush_events',             [ $this, 'flush_events' ] );
    }

    // -------------------------------------------------------------------------
    // Cron
    // -------------------------------------------------------------------------

    /**
     * Add a 15-minute cron interval.
     *
     * @param array $schedules
     * @return array
     */
    public function add_cron_interval( array $schedules ): array {
        $schedules['shelf_quarter_hour'] = [
            'interval' => 900,
            'display'  => __( 'Every 15 Minutes (Shelf)', 'shelf-woocommerce' ),
        ];
        return $schedules;
    }

    // -------------------------------------------------------------------------
    // Event capture
    // -------------------------------------------------------------------------

    /**
     * Capture frontend search queries.
     * Runs on pre_get_posts; the actual result count is stored via a
     * shutdown-time transient because the query hasn't run yet.
     *
     * @param WP_Query $query
     * @return void
     */
    public function capture_search( WP_Query $query ): void {
        if ( ! $query->is_main_query() || ! $query->is_search() || is_admin() ) {
            return;
        }

        $search_term = sanitize_text_field( $query->get( 's' ) );
        if ( '' === $search_term ) {
            return;
        }

        // We hook into wp_footer (or shutdown) to read the found_posts count.
        add_action(
            'wp_footer',
            function () use ( $query, $search_term ) {
                $found = (int) $query->found_posts;
                $this->buffer_search( $search_term, $found );
            }
        );
    }

    /**
     * Buffer an add-to-cart event.
     *
     * @param string $cart_item_key
     * @param int    $product_id
     * @param int    $quantity
     * @param int    $variation_id
     * @param array  $variation
     * @param array  $cart_item_data
     * @return void
     */
    public function on_add_to_cart(
        string $cart_item_key,
        int $product_id,
        int $quantity,
        int $variation_id,
        array $variation,
        array $cart_item_data
    ): void {
        $this->buffer_cart_event( 'add', $product_id, $variation_id ?: $product_id, $quantity );
        $this->update_pending_cart();
    }

    /**
     * Buffer a remove-from-cart event.
     *
     * @param string $cart_item_key
     * @param array  $cart
     * @return void
     */
    public function on_remove_from_cart( string $cart_item_key, array $cart ): void {
        $item = $cart[ $cart_item_key ] ?? null;
        if ( ! $item ) {
            return;
        }
        $this->buffer_cart_event(
            'remove',
            (int) $item['product_id'],
            (int) ( $item['variation_id'] ?: $item['product_id'] ),
            (int) $item['quantity']
        );
        $this->update_pending_cart();
    }

    /**
     * Buffer purchase events for all items in the order.
     *
     * @param int $order_id
     * @return void
     */
    public function on_purchase( int $order_id ): void {
        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            return;
        }

        foreach ( $order->get_items() as $item ) {
            /** @var WC_Order_Item_Product $item */
            $this->buffer_cart_event(
                'purchase',
                (int) $item->get_product_id(),
                (int) ( $item->get_variation_id() ?: $item->get_product_id() ),
                (int) $item->get_quantity(),
                $order_id
            );
        }

        // Clear pending cart — the customer converted.
        $session_id = $this->get_session_id();
        delete_transient( self::PENDING_CART . '_' . $session_id );
    }

    /**
     * Cart-abandon detection: compare current cart to the pending cart from
     * the previous session.  Fires when WooCommerce reloads the cart from the
     * session on a fresh page visit.
     *
     * @return void
     */
    public function check_cart_abandon(): void {
        $session_id  = $this->get_session_id();
        $pending_key = self::PENDING_CART . '_' . $session_id;
        $pending     = get_transient( $pending_key );

        if ( empty( $pending['items'] ) || empty( $pending['timestamp'] ) ) {
            return;
        }

        // If the pending cart is from a different "hour block" it's a new visit.
        $age_seconds = time() - (int) $pending['timestamp'];
        if ( $age_seconds < 300 ) {
            // Less than 5 minutes — probably a page reload, not abandonment.
            return;
        }

        // Current WC cart contents.
        $current_cart = WC()->cart ? WC()->cart->get_cart() : [];
        $current_ids  = array_map(
            fn( $ci ) => (int) $ci['product_id'],
            array_values( $current_cart )
        );

        foreach ( $pending['items'] as $item ) {
            if ( ! in_array( (int) $item['product_id'], $current_ids, true ) ) {
                $this->buffer_cart_event(
                    'abandon',
                    (int) $item['product_id'],
                    (int) ( $item['variation_id'] ?: $item['product_id'] ),
                    (int) $item['quantity']
                );
            }
        }

        // Remove pending so we don't re-report it.
        delete_transient( $pending_key );
    }

    // -------------------------------------------------------------------------
    // Flush
    // -------------------------------------------------------------------------

    /**
     * Read buffered events, POST to Shelf API, clear the buffers.
     *
     * @return void
     */
    public function flush_events(): void {
        if ( '' === Shelf_API::get_api_key() || '' === Shelf_API::get_store_id() ) {
            return;
        }

        $store_id = Shelf_API::get_store_id();

        // --- Searches ---
        $searches = get_transient( self::SEARCH_BUFFER );
        if ( ! empty( $searches ) ) {
            Shelf_API::post(
                '/ingest/searches',
                [
                    'store_id' => $store_id,
                    'searches' => $searches,
                ]
            );
            delete_transient( self::SEARCH_BUFFER );
        }

        // --- Cart events (add / remove / purchase / abandon) ---
        $cart_events = get_transient( self::CART_BUFFER );
        if ( ! empty( $cart_events ) ) {
            Shelf_API::post(
                '/ingest/cart-events',
                [
                    'store_id'    => $store_id,
                    'cart_events' => $cart_events,
                ]
            );
            delete_transient( self::CART_BUFFER );
        }
    }

    // -------------------------------------------------------------------------
    // Buffer helpers
    // -------------------------------------------------------------------------

    /**
     * Append a search event to the search buffer transient.
     *
     * @param string $term
     * @param int    $results_count
     * @return void
     */
    private function buffer_search( string $term, int $results_count ): void {
        $buffer   = get_transient( self::SEARCH_BUFFER );
        $buffer   = is_array( $buffer ) ? $buffer : [];
        $buffer[] = [
            'term'          => $term,
            'results_count' => $results_count,
            'timestamp'     => gmdate( 'c' ),
        ];
        set_transient( self::SEARCH_BUFFER, $buffer, self::BUFFER_TTL );
    }

    /**
     * Append a cart event to the cart-event buffer transient.
     *
     * @param string   $type         'add' | 'remove' | 'purchase' | 'abandon'
     * @param int      $product_id
     * @param int      $variant_id
     * @param int      $quantity
     * @param int|null $order_id
     * @return void
     */
    private function buffer_cart_event(
        string $type,
        int $product_id,
        int $variant_id,
        int $quantity,
        ?int $order_id = null
    ): void {
        $buffer   = get_transient( self::CART_BUFFER );
        $buffer   = is_array( $buffer ) ? $buffer : [];
        $event    = [
            'type'       => $type,
            'product_id' => (string) $product_id,
            'variant_id' => (string) $variant_id,
            'quantity'   => $quantity,
            'timestamp'  => gmdate( 'c' ),
        ];
        if ( null !== $order_id ) {
            $event['order_id'] = (string) $order_id;
        }
        $buffer[] = $event;
        set_transient( self::CART_BUFFER, $buffer, self::BUFFER_TTL );
    }

    /**
     * Snapshot the current cart into a pending-cart transient for abandon detection.
     *
     * @return void
     */
    private function update_pending_cart(): void {
        if ( ! WC()->cart ) {
            return;
        }

        $items      = [];
        $cart_items = WC()->cart->get_cart();
        foreach ( $cart_items as $cart_item ) {
            $items[] = [
                'product_id'   => (int) $cart_item['product_id'],
                'variation_id' => (int) ( $cart_item['variation_id'] ?? 0 ),
                'quantity'     => (int) $cart_item['quantity'],
            ];
        }

        $session_id  = $this->get_session_id();
        $pending_key = self::PENDING_CART . '_' . $session_id;

        set_transient(
            $pending_key,
            [
                'items'      => $items,
                'timestamp'  => time(),
                'session_id' => $session_id,
            ],
            self::PENDING_CART_TTL
        );
    }

    /**
     * Return a stable session identifier for the current visitor.
     *
     * @return string
     */
    private function get_session_id(): string {
        if ( ! empty( $_COOKIE['shelf_session'] ) ) {
            return sanitize_text_field( wp_unslash( $_COOKIE['shelf_session'] ) );
        }
        if ( function_exists( 'WC' ) && WC()->session ) {
            $id = WC()->session->get_customer_id();
            if ( $id ) {
                return (string) $id;
            }
        }
        return 'guest_' . ( isset( $_SERVER['REMOTE_ADDR'] ) ? md5( sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) ) : 'unknown' );
    }
}
