<?php
/**
 * Plugin Name: Shelf for WooCommerce
 * Plugin URI:  https://shelf.io
 * Description: Connect your WooCommerce store to Shelf for buyer intelligence and analytics.
 * Version:     1.5.1
 * Author:      Shelf
 * Author URI:  https://shelf.io
 * License:     GPL-2.0+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: shelf-woocommerce
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'SHELF_VERSION', '1.5.1' );
define( 'SHELF_API_URL', 'https://shelf-7a6211a30e15.herokuapp.com' );
define( 'SHELF_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SHELF_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once SHELF_PLUGIN_DIR . 'includes/class-shelf-api.php';
require_once SHELF_PLUGIN_DIR . 'includes/class-shelf-sync.php';
require_once SHELF_PLUGIN_DIR . 'includes/class-shelf-tracker.php';
require_once SHELF_PLUGIN_DIR . 'includes/class-shelf-activity.php';
require_once SHELF_PLUGIN_DIR . 'admin/class-shelf-admin.php';

add_action( 'plugins_loaded', function () {
    if ( ! class_exists( 'WooCommerce' ) ) {
        add_action( 'admin_notices', function () {
            echo '<div class="notice notice-error"><p><strong>Shelf for WooCommerce</strong> requires WooCommerce to be installed and active.</p></div>';
        } );
        return;
    }

    new Shelf_Admin();
    new Shelf_Tracker();
    new Shelf_Activity();
} );

register_activation_hook( __FILE__, function () {
    if ( ! wp_next_scheduled( 'shelf_sync_products' ) ) {
        wp_schedule_event( time(), 'hourly', 'shelf_sync_products' );
    }
    if ( ! wp_next_scheduled( 'shelf_send_activity' ) ) {
        wp_schedule_event( time(), 'hourly', 'shelf_send_activity' );
    }
} );

register_deactivation_hook( __FILE__, function () {
    $hooks = [ 'shelf_sync_products', 'shelf_send_activity', 'shelf_flush_events' ];
    foreach ( $hooks as $hook ) {
        $ts = wp_next_scheduled( $hook );
        if ( $ts ) {
            wp_unschedule_event( $ts, $hook );
        }
    }
} );

add_action( 'shelf_sync_products', [ 'Shelf_Sync', 'run' ] );
add_action( 'shelf_send_activity', [ 'Shelf_Activity', 'flush' ] );
