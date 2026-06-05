<?php
/**
 * Shelf Sync — pushes WooCommerce products to the Shelf API.
 *
 * @package Shelf_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Shelf_Sync {

    /**
     * Batch size for API calls.
     */
    const BATCH_SIZE = 100;

    /**
     * Query all published WooCommerce products, map them to the Shelf schema,
     * and send them to /ingest/products in batches of 100.
     *
     * @return void
     */
    public static function run(): void {
        if ( '' === Shelf_API::get_api_key() || '' === Shelf_API::get_store_id() ) {
            return;
        }

        $page  = 1;
        $batch = [];

        do {
            $products = wc_get_products(
                [
                    'status'   => 'publish',
                    'limit'    => self::BATCH_SIZE,
                    'page'     => $page,
                    'paginate' => false,
                ]
            );

            if ( empty( $products ) ) {
                break;
            }

            foreach ( $products as $product ) {
                $batch[] = self::map_product( $product );

                if ( count( $batch ) >= self::BATCH_SIZE ) {
                    self::send_batch( $batch );
                    $batch = [];
                }
            }

            $page ++;
        } while ( count( $products ) === self::BATCH_SIZE );

        // Send any remaining items.
        if ( ! empty( $batch ) ) {
            self::send_batch( $batch );
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Send a batch of mapped products to the API.
     *
     * @param array $batch
     * @return void
     */
    private static function send_batch( array $batch ): void {
        Shelf_API::post(
            '/ingest/products',
            [
                'store_id' => Shelf_API::get_store_id(),
                'products' => $batch,
            ]
        );
    }

    /**
     * Map a WC_Product to the Shelf API schema.
     *
     * @param WC_Product $product
     * @return array
     */
    private static function map_product( WC_Product $product ): array {
        $image_id  = $product->get_image_id();
        $image_url = $image_id ? wp_get_attachment_url( $image_id ) : '';

        $category_names = [];
        $term_ids       = $product->get_category_ids();
        foreach ( $term_ids as $term_id ) {
            $term = get_term( $term_id, 'product_cat' );
            if ( $term && ! is_wp_error( $term ) ) {
                $category_names[] = $term->name;
            }
        }

        $tag_names = [];
        $tag_ids   = $product->get_tag_ids();
        foreach ( $tag_ids as $tag_id ) {
            $tag = get_term( $tag_id, 'product_tag' );
            if ( $tag && ! is_wp_error( $tag ) ) {
                $tag_names[] = $tag->name;
            }
        }

        return [
            'id'          => (string) $product->get_id(),
            'sku'         => $product->get_sku(),
            'name'        => $product->get_name(),
            'description' => wp_strip_all_tags( $product->get_description() ),
            'short_desc'  => wp_strip_all_tags( $product->get_short_description() ),
            'price'       => $product->get_price(),
            'sale_price'  => $product->get_sale_price(),
            'regular_price' => $product->get_regular_price(),
            'currency'    => get_woocommerce_currency(),
            'stock_status' => $product->get_stock_status(),
            'stock_qty'   => $product->get_stock_quantity(),
            'categories'  => $category_names,
            'tags'        => $tag_names,
            'image_url'   => $image_url ?: '',
            'permalink'   => get_permalink( $product->get_id() ),
            'type'        => $product->get_type(),
            'date_created' => $product->get_date_created()
                ? $product->get_date_created()->date( 'c' )
                : '',
            'date_modified' => $product->get_date_modified()
                ? $product->get_date_modified()->date( 'c' )
                : '',
        ];
    }
}
