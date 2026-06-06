<?php
/**
 * Shelf Activity — tracks page views and unique visitors, flushes hourly.
 *
 * @package Shelf_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Shelf_Activity {

    /**
     * Transient key prefix for hourly activity buckets.
     */
    const KEY_PREFIX = 'shelf_activity_';

    /**
     * Cookie name used to distinguish unique visitors.
     */
    const COOKIE_NAME = 'shelf_session';

    public function __construct() {
        add_action( 'wp', [ $this, 'record_visit' ] );
    }

    /**
     * Increment the view/user counters for the current hour.
     *
     * @return void
     */
    public function record_visit(): void {
        if ( is_admin() ) {
            return;
        }

        $hour    = gmdate( 'Y-m-d\TH:00:00\Z' );
        $key     = self::KEY_PREFIX . $hour;
        $current = get_transient( $key );

        if ( ! is_array( $current ) ) {
            $current = [ 'users' => 0, 'views' => 0, 'hour' => $hour ];
        }

        $current['views'] ++;

        $cookie_name = self::COOKIE_NAME;
        if ( empty( $_COOKIE[ $cookie_name ] ) ) {
            $current['users'] ++;
            $cookie_value = wp_generate_uuid4();
            // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.cookies_setcookie
            setcookie( $cookie_name, $cookie_value, time() + HOUR_IN_SECONDS, '/', '', is_ssl(), true );
        }

        set_transient( $key, $current, 2 * HOUR_IN_SECONDS );
    }

    /**
     * Read the previous completed hour's transient, POST to /ingest/activity,
     * and delete it.  Called by the hourly cron (`shelf_send_activity`).
     *
     * @return void
     */
    public static function flush(): void {
        if ( '' === Shelf_API::get_api_key() || '' === Shelf_API::get_store_id() ) {
            return;
        }

        // Flush the hour that just completed (current hour - 1).
        $prev_hour = gmdate( 'Y-m-d\TH:00:00\Z', time() - HOUR_IN_SECONDS );
        $key       = self::KEY_PREFIX . $prev_hour;
        $data      = get_transient( $key );

        if ( empty( $data ) ) {
            return;
        }

        Shelf_API::post(
            '/ingest/activity',
            [
                'logs' => [
                    [
                        'hour_bucket'  => $prev_hour,
                        'active_users' => (int) $data['users'],
                        'page_views'   => (int) $data['views'],
                    ],
                ],
            ]
        );

        delete_transient( $key );
    }
}
