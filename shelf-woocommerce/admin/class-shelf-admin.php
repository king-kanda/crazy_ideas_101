<?php
/**
 * Shelf Admin — WordPress admin menu, settings, and asset loading.
 *
 * @package Shelf_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Shelf_Admin {

    /**
     * Slug used for the top-level admin menu page.
     */
    const MENU_SLUG = 'shelf';

    public function __construct() {
        add_action( 'admin_menu',            [ $this, 'add_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
        add_action( 'admin_post_shelf_save_settings', [ $this, 'save_settings' ] );
    }

    // -------------------------------------------------------------------------
    // Menu
    // -------------------------------------------------------------------------

    /**
     * Register the top-level Shelf menu and its two subpages.
     *
     * @return void
     */
    public function add_menu(): void {
        add_menu_page(
            __( 'Shelf', 'shelf-woocommerce' ),
            __( 'Shelf', 'shelf-woocommerce' ),
            'manage_options',
            self::MENU_SLUG,
            [ $this, 'render_settings' ],
            'dashicons-chart-line',
            56
        );

        add_submenu_page(
            self::MENU_SLUG,
            __( 'Settings', 'shelf-woocommerce' ),
            __( 'Settings', 'shelf-woocommerce' ),
            'manage_options',
            self::MENU_SLUG,
            [ $this, 'render_settings' ]
        );

        add_submenu_page(
            self::MENU_SLUG,
            __( 'Insights', 'shelf-woocommerce' ),
            __( 'Insights', 'shelf-woocommerce' ),
            'manage_options',
            'shelf-insights',
            [ $this, 'render_insights' ]
        );
    }

    /**
     * Render the Settings page.
     *
     * @return void
     */
    public function render_settings(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have sufficient permissions.', 'shelf-woocommerce' ) );
        }
        require_once SHELF_PLUGIN_DIR . 'admin/views/settings.php';
    }

    /**
     * Render the Insights page.
     *
     * @return void
     */
    public function render_insights(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have sufficient permissions.', 'shelf-woocommerce' ) );
        }
        require_once SHELF_PLUGIN_DIR . 'admin/views/insights.php';
    }

    // -------------------------------------------------------------------------
    // Assets
    // -------------------------------------------------------------------------

    /**
     * Enqueue CSS and JS only on Shelf admin pages.
     *
     * @param string $hook_suffix  The current admin page hook suffix.
     * @return void
     */
    public function enqueue( string $hook_suffix ): void {
        $shelf_pages = [
            'toplevel_page_shelf',
            'shelf_page_shelf-insights',
        ];

        if ( ! in_array( $hook_suffix, $shelf_pages, true ) ) {
            return;
        }

        wp_enqueue_style(
            'shelf-admin',
            SHELF_PLUGIN_URL . 'assets/shelf-admin.css',
            [],
            SHELF_VERSION
        );

        wp_enqueue_script(
            'shelf-admin',
            SHELF_PLUGIN_URL . 'assets/shelf-admin.js',
            [],
            SHELF_VERSION,
            true
        );

        wp_localize_script(
            'shelf-admin',
            'SHELF_ADMIN',
            [
                'api_url'  => Shelf_API::get_api_url(),
                'api_key'  => Shelf_API::get_api_key(),
                'store_id' => Shelf_API::get_store_id(),
                'nonce'    => wp_create_nonce( 'shelf_admin' ),
            ]
        );
    }

    // -------------------------------------------------------------------------
    // Settings save
    // -------------------------------------------------------------------------

    /**
     * Handle the settings form POST.
     * Validates nonce, saves options, verifies the API key with Shelf,
     * then redirects back to the settings page.
     *
     * @return void
     */
    public function save_settings(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have sufficient permissions.', 'shelf-woocommerce' ) );
        }

        check_admin_referer( 'shelf_save_settings', 'shelf_nonce' );

        // Sanitise and save each option.
        $api_key  = isset( $_POST['shelf_api_key'] )           ? sanitize_text_field( wp_unslash( $_POST['shelf_api_key'] ) )           : '';
        $api_url  = isset( $_POST['shelf_api_url'] )           ? esc_url_raw( wp_unslash( $_POST['shelf_api_url'] ) )                   : '';
        $niche    = isset( $_POST['shelf_niche'] )             ? sanitize_text_field( wp_unslash( $_POST['shelf_niche'] ) )             : '';
        $country  = isset( $_POST['shelf_location_country'] )  ? sanitize_text_field( wp_unslash( $_POST['shelf_location_country'] ) )  : '';
        $city     = isset( $_POST['shelf_location_city'] )     ? sanitize_text_field( wp_unslash( $_POST['shelf_location_city'] ) )     : '';

        update_option( 'shelf_api_key',          $api_key );
        update_option( 'shelf_api_url',          $api_url ?: SHELF_API_URL );
        update_option( 'shelf_niche',            $niche );
        update_option( 'shelf_location_country', $country );
        update_option( 'shelf_location_city',    $city );

        // Verify with Shelf API and retrieve / store the store ID.
        if ( '' !== $api_key ) {
            $response = Shelf_API::get( '/auth/verify', $api_key );

            if ( isset( $response['error'] ) || empty( $response['store_id'] ) ) {
                // Key is invalid or API call failed.
                update_option( 'shelf_store_id', '' );
                wp_safe_redirect(
                    add_query_arg( 'status', 'invalid', admin_url( 'admin.php?page=shelf' ) )
                );
                exit;
            }

            update_option( 'shelf_store_id', sanitize_text_field( $response['store_id'] ) );
        } else {
            update_option( 'shelf_store_id', '' );
        }

        wp_safe_redirect(
            add_query_arg( 'status', 'saved', admin_url( 'admin.php?page=shelf' ) )
        );
        exit;
    }
}
