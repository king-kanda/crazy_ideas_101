<?php
/**
 * Shelf Settings page view.
 *
 * @package Shelf_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) exit;

$api_key  = get_option( 'shelf_api_key', '' );
$niche    = get_option( 'shelf_niche', '' );
$country  = get_option( 'shelf_location_country', '' );
$city     = get_option( 'shelf_location_city', '' );
$store_id = get_option( 'shelf_store_id', '' );

$status   = isset( $_GET['status'] ) ? sanitize_text_field( wp_unslash( $_GET['status'] ) ) : '';

$niches = [
    ''           => __( '— Select a niche —', 'shelf-woocommerce' ),
    'Electronics' => __( 'Electronics', 'shelf-woocommerce' ),
    'Fashion'     => __( 'Fashion', 'shelf-woocommerce' ),
    'Furniture'   => __( 'Furniture', 'shelf-woocommerce' ),
    'Beauty'      => __( 'Beauty', 'shelf-woocommerce' ),
    'Food'        => __( 'Food', 'shelf-woocommerce' ),
    'Other'       => __( 'Other', 'shelf-woocommerce' ),
];
?>
<div class="wrap shelf-wrap">
    <div class="shelf-header">
        <span class="dashicons dashicons-chart-line shelf-logo-icon"></span>
        <h1><?php esc_html_e( 'Shelf — Buyer Intelligence', 'shelf-woocommerce' ); ?></h1>
    </div>

    <?php if ( 'saved' === $status ) : ?>
        <div class="notice notice-success shelf-notice is-dismissible">
            <p>
                <strong><?php esc_html_e( 'Settings saved.', 'shelf-woocommerce' ); ?></strong>
                <?php if ( '' !== $store_id ) : ?>
                    <?php
                    printf(
                        /* translators: %s: store ID */
                        esc_html__( 'Connected to Shelf. Store ID: %s', 'shelf-woocommerce' ),
                        '<code>' . esc_html( $store_id ) . '</code>'
                    );
                    ?>
                <?php endif; ?>
            </p>
        </div>
    <?php elseif ( 'invalid' === $status ) : ?>
        <div class="notice notice-error shelf-notice is-dismissible">
            <p>
                <strong><?php esc_html_e( 'Could not verify API key.', 'shelf-woocommerce' ); ?></strong>
                <?php esc_html_e( 'Please check your key and try again. Other settings were saved.', 'shelf-woocommerce' ); ?>
            </p>
        </div>
    <?php endif; ?>

    <div class="shelf-card">
        <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
            <input type="hidden" name="action" value="shelf_save_settings">
            <?php wp_nonce_field( 'shelf_save_settings', 'shelf_nonce' ); ?>

            <table class="form-table shelf-form-table" role="presentation">
                <tbody>
                    <tr>
                        <th scope="row">
                            <label for="shelf_api_key">
                                <?php esc_html_e( 'API Key', 'shelf-woocommerce' ); ?>
                            </label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="shelf_api_key"
                                name="shelf_api_key"
                                value="<?php echo esc_attr( $api_key ); ?>"
                                class="regular-text shelf-api-key-input"
                                placeholder="sk_live_..."
                                autocomplete="off"
                            >
                            <p class="description">
                                <?php
                                printf(
                                    /* translators: %s: link to shelf.io */
                                    esc_html__( 'Find your API key in the %s dashboard.', 'shelf-woocommerce' ),
                                    '<a href="https://app.shelf.io/settings/api" target="_blank" rel="noopener noreferrer">Shelf</a>'
                                );
                                ?>
                            </p>
                            <?php if ( '' !== $store_id ) : ?>
                                <p class="description shelf-connected-indicator">
                                    <span class="dashicons dashicons-yes-alt" style="color:#46b450;"></span>
                                    <?php
                                    printf(
                                        esc_html__( 'Connected — Store ID: %s', 'shelf-woocommerce' ),
                                        '<code>' . esc_html( $store_id ) . '</code>'
                                    );
                                    ?>
                                </p>
                            <?php endif; ?>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="shelf_niche">
                                <?php esc_html_e( 'Store Niche', 'shelf-woocommerce' ); ?>
                            </label>
                        </th>
                        <td>
                            <select id="shelf_niche" name="shelf_niche" class="shelf-select">
                                <?php foreach ( $niches as $value => $label ) : ?>
                                    <option value="<?php echo esc_attr( $value ); ?>" <?php selected( $niche, $value ); ?>>
                                        <?php echo esc_html( $label ); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                            <p class="description">
                                <?php esc_html_e( 'Helps Shelf benchmark your store against similar businesses.', 'shelf-woocommerce' ); ?>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="shelf_location_country">
                                <?php esc_html_e( 'Country', 'shelf-woocommerce' ); ?>
                            </label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="shelf_location_country"
                                name="shelf_location_country"
                                value="<?php echo esc_attr( $country ); ?>"
                                class="regular-text"
                                placeholder="<?php esc_attr_e( 'e.g. United States', 'shelf-woocommerce' ); ?>"
                            >
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="shelf_location_city">
                                <?php esc_html_e( 'City', 'shelf-woocommerce' ); ?>
                            </label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="shelf_location_city"
                                name="shelf_location_city"
                                value="<?php echo esc_attr( $city ); ?>"
                                class="regular-text"
                                placeholder="<?php esc_attr_e( 'e.g. New York', 'shelf-woocommerce' ); ?>"
                            >
                        </td>
                    </tr>
                </tbody>
            </table>

            <p class="submit">
                <button type="submit" class="button button-primary shelf-save-btn">
                    <span class="dashicons dashicons-cloud-upload" style="vertical-align:middle;margin-right:4px;margin-top:-2px;"></span>
                    <?php esc_html_e( 'Save & Verify Connection', 'shelf-woocommerce' ); ?>
                </button>
            </p>
        </form>
    </div>

    <div class="shelf-card shelf-info-card">
        <h2><?php esc_html_e( 'What does Shelf sync?', 'shelf-woocommerce' ); ?></h2>
        <ul class="shelf-feature-list">
            <li><span class="dashicons dashicons-cart"></span> <?php esc_html_e( 'Add-to-cart, remove, and purchase events', 'shelf-woocommerce' ); ?></li>
            <li><span class="dashicons dashicons-search"></span> <?php esc_html_e( 'On-site search queries and result counts', 'shelf-woocommerce' ); ?></li>
            <li><span class="dashicons dashicons-warning"></span> <?php esc_html_e( 'Cart abandonment signals', 'shelf-woocommerce' ); ?></li>
            <li><span class="dashicons dashicons-products"></span> <?php esc_html_e( 'Product catalog (synced hourly)', 'shelf-woocommerce' ); ?></li>
            <li><span class="dashicons dashicons-visibility"></span> <?php esc_html_e( 'Page views and unique visitor counts', 'shelf-woocommerce' ); ?></li>
        </ul>
        <p class="description">
            <?php esc_html_e( 'No personally identifiable information is ever sent to Shelf.', 'shelf-woocommerce' ); ?>
        </p>
    </div>
</div>
