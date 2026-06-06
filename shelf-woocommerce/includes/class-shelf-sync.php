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
        Shelf_API::post( '/ingest/products', [ 'products' => $batch ] );
    }

    /**
     * Map a WC_Product to the Shelf API schema.
     *
     * @param WC_Product $product
     * @return array
     */
    private static function map_product( WC_Product $product ): array {
        $category = null;
        foreach ( $product->get_category_ids() as $term_id ) {
            $term = get_term( $term_id, 'product_cat' );
            if ( $term && ! is_wp_error( $term ) ) {
                $category = $term->name;
                break;
            }
        }

        $price = $product->get_price();

        return [
            'wc_product_id' => (int) $product->get_id(),
            'name'          => $product->get_name(),
            'category'      => $category,
            'price'         => '' !== $price ? (float) $price : null,
            'stock_status'  => $product->get_stock_status(),
        ];
    }
}
