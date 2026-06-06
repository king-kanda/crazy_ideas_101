<?php
/**
 * Shelf Tracker — sends search, cart, and purchase events to the API in real time.
 *
 * @package Shelf_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Shelf_Tracker {

    /** Transient key for cart-abandon detection. */
    const PENDING_CART     = 'shelf_pending_cart';
    const PENDING_CART_TTL = DAY_IN_SECONDS;

    public function __construct() {
        add_action( 'pre_get_posts',                        [ $this, 'capture_search' ] );
        add_action( 'woocommerce_add_to_cart',              [ $this, 'on_add_to_cart' ],      10, 6 );
        add_action( 'woocommerce_cart_item_removed',        [ $this, 'on_remove_from_cart' ], 10, 2 );
        add_action( 'woocommerce_thankyou',                 [ $this, 'on_purchase' ] );
        add_action( 'woocommerce_cart_loaded_from_session', [ $this, 'check_cart_abandon' ] );
    }

    // -------------------------------------------------------------------------
    // Event capture — fire immediately
    // -------------------------------------------------------------------------

    /**
     * Capture frontend search queries and send immediately after the page renders.
     */
    public function capture_search( WP_Query $query ): void {
        if ( ! $query->is_main_query() || ! $query->is_search() || is_admin() ) {
            return;
        }

        $search_term = sanitize_text_field( $query->get( 's' ) );
        if ( '' === $search_term ) {
            return;
        }

        add_action(
            'wp_footer',
            function () use ( $query, $search_term ) {
                $found = (int) $query->found_posts;
                $this->send_search( $search_term, $found );
            }
        );
    }

    public function on_add_to_cart(
        $cart_item_key,
        $product_id,
        $quantity,
        $variation_id,
        $variation,
        $cart_item_data
    ): void {
        $this->send_cart_event( 'add_to_cart', (int) $product_id );
        $this->update_pending_cart();
    }

    public function on_remove_from_cart( $cart_item_key, $cart ): void {
        $item = $cart->removed_cart_contents[ $cart_item_key ] ?? null;
        if ( ! $item ) {
            return;
        }
        $this->send_cart_event( 'remove', (int) $item['product_id'] );
        $this->update_pending_cart();
    }

    public function on_purchase( $order_id ): void {
        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            return;
        }

        $events = [];
        foreach ( $order->get_items() as $item ) {
            /** @var WC_Order_Item_Product $item */
            $events[] = [
                'event_type'    => 'purchase',
                'wc_product_id' => (int) $item->get_product_id(),
                'session_id'    => $this->get_session_id(),
                'occurred_at'   => gmdate( 'Y-m-d\TH:i:s\Z' ),
            ];
        }

        if ( ! empty( $events ) ) {
            Shelf_API::post( '/ingest/cart-events', [ 'events' => $events ] );
        }

        delete_transient( self::PENDING_CART . '_' . $this->get_session_id() );
    }

    public function check_cart_abandon( $wc_cart = null ): void {
        $session_id  = $this->get_session_id();
        $pending_key = self::PENDING_CART . '_' . $session_id;
        $pending     = get_transient( $pending_key );

        if ( empty( $pending['items'] ) || empty( $pending['timestamp'] ) ) {
            return;
        }

        $age_seconds = time() - (int) $pending['timestamp'];
        if ( $age_seconds < 300 ) {
            return;
        }

        $current_cart = WC()->cart ? WC()->cart->get_cart() : [];
        $current_ids  = array_map(
            fn( $ci ) => (int) $ci['product_id'],
            array_values( $current_cart )
        );

        $events = [];
        foreach ( $pending['items'] as $item ) {
            if ( ! in_array( (int) $item['product_id'], $current_ids, true ) ) {
                $events[] = [
                    'event_type'    => 'abandoned',
                    'wc_product_id' => (int) $item['product_id'],
                    'session_id'    => $session_id,
                    'occurred_at'   => gmdate( 'Y-m-d\TH:i:s\Z' ),
                ];
            }
        }

        if ( ! empty( $events ) ) {
            Shelf_API::post( '/ingest/cart-events', [ 'events' => $events ] );
        }

        delete_transient( $pending_key );
    }

    // -------------------------------------------------------------------------
    // Static flush — kept for Sync Now button compatibility
    // -------------------------------------------------------------------------

    public static function flush_events_static(): void {
        // No-op: events now fire in real time. Kept so Sync Now doesn't error.
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function send_search( string $term, int $results_count ): void {
        Shelf_API::post( '/ingest/searches', [
            'events' => [
                [
                    'query'              => $term,
                    'results_count'      => $results_count,
                    'user_found_product' => $results_count > 0,
                    'occurred_at'        => gmdate( 'Y-m-d\TH:i:s\Z' ),
                ],
            ],
        ] );
    }

    private function send_cart_event( string $type, int $product_id ): void {
        Shelf_API::post( '/ingest/cart-events', [
            'events' => [
                [
                    'event_type'    => $type,
                    'wc_product_id' => $product_id,
                    'session_id'    => $this->get_session_id(),
                    'occurred_at'   => gmdate( 'Y-m-d\TH:i:s\Z' ),
                ],
            ],
        ] );
    }

    private function update_pending_cart(): void {
        if ( ! WC()->cart ) {
            return;
        }

        $items = [];
        foreach ( WC()->cart->get_cart() as $cart_item ) {
            $items[] = [
                'product_id'   => (int) $cart_item['product_id'],
                'variation_id' => (int) ( $cart_item['variation_id'] ?? 0 ),
                'quantity'     => (int) $cart_item['quantity'],
            ];
        }

        $pending_key = self::PENDING_CART . '_' . $this->get_session_id();
        set_transient(
            $pending_key,
            [ 'items' => $items, 'timestamp' => time() ],
            self::PENDING_CART_TTL
        );
    }

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
