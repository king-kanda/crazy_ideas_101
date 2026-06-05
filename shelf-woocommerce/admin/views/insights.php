<?php
/**
 * Shelf Insights page view.
 *
 * @package Shelf_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) exit;

$store_id = get_option( 'shelf_store_id', '' );
$api_key  = get_option( 'shelf_api_key', '' );
?>
<div class="wrap shelf-wrap">
    <div class="shelf-header">
        <span class="dashicons dashicons-chart-line shelf-logo-icon"></span>
        <h1><?php esc_html_e( 'Shelf Insights', 'shelf-woocommerce' ); ?></h1>
    </div>

    <?php if ( '' === $api_key || '' === $store_id ) : ?>
        <div class="notice notice-warning shelf-notice">
            <p>
                <?php
                printf(
                    /* translators: %s: settings page link */
                    esc_html__( 'Please %s before viewing insights.', 'shelf-woocommerce' ),
                    '<a href="' . esc_url( admin_url( 'admin.php?page=shelf' ) ) . '">' .
                        esc_html__( 'connect your Shelf account', 'shelf-woocommerce' ) .
                    '</a>'
                );
                ?>
            </p>
        </div>
    <?php endif; ?>

    <!-- Tab navigation -->
    <div class="shelf-tabs" role="tablist">
        <button
            class="shelf-tab shelf-tab--active"
            role="tab"
            aria-selected="true"
            aria-controls="tab-demand"
            data-tab="tab-demand"
        ><?php esc_html_e( 'Demand Gaps', 'shelf-woocommerce' ); ?></button>

        <button
            class="shelf-tab"
            role="tab"
            aria-selected="false"
            aria-controls="tab-store"
            data-tab="tab-store"
        ><?php esc_html_e( 'Store Health', 'shelf-woocommerce' ); ?></button>

        <button
            class="shelf-tab"
            role="tab"
            aria-selected="false"
            aria-controls="tab-activity"
            data-tab="tab-activity"
        ><?php esc_html_e( 'Activity', 'shelf-woocommerce' ); ?></button>
    </div>

    <!-- ================================================================== -->
    <!-- TAB: Demand Gaps                                                    -->
    <!-- ================================================================== -->
    <div id="tab-demand" class="shelf-tab-panel" role="tabpanel">
        <div class="shelf-panel-grid">

            <!-- Top Searches -->
            <div class="shelf-card shelf-card--full">
                <h2><?php esc_html_e( 'Top Searches', 'shelf-woocommerce' ); ?></h2>
                <div class="shelf-table-wrap">
                    <table id="shelf-top-searches" class="widefat shelf-data-table">
                        <thead>
                            <tr>
                                <th><?php esc_html_e( 'Search Term', 'shelf-woocommerce' ); ?></th>
                                <th><?php esc_html_e( 'Volume', 'shelf-woocommerce' ); ?></th>
                                <th><?php esc_html_e( 'Avg Results', 'shelf-woocommerce' ); ?></th>
                                <th><?php esc_html_e( 'Trend', 'shelf-woocommerce' ); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="shelf-loading-row">
                                <td colspan="4">
                                    <span class="shelf-spinner"></span>
                                    <?php esc_html_e( 'Loading…', 'shelf-woocommerce' ); ?>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Search Trend Chart -->
            <div class="shelf-card shelf-card--half">
                <h2><?php esc_html_e( 'Search Volume Trend', 'shelf-woocommerce' ); ?></h2>
                <div class="shelf-chart-wrap">
                    <canvas id="shelf-trend-chart" width="600" height="300" aria-label="<?php esc_attr_e( 'Search volume trend chart', 'shelf-woocommerce' ); ?>" role="img"></canvas>
                </div>
            </div>

            <!-- Demand Gaps -->
            <div class="shelf-card shelf-card--half">
                <h2><?php esc_html_e( 'Demand Gaps', 'shelf-woocommerce' ); ?></h2>
                <p class="description"><?php esc_html_e( 'Queries with high search volume but few or no matching products.', 'shelf-woocommerce' ); ?></p>
                <div id="shelf-gaps" class="shelf-gaps-container">
                    <div class="shelf-loading">
                        <span class="shelf-spinner"></span>
                        <?php esc_html_e( 'Analysing gaps…', 'shelf-woocommerce' ); ?>
                    </div>
                </div>
            </div>

        </div><!-- .shelf-panel-grid -->
    </div><!-- #tab-demand -->

    <!-- ================================================================== -->
    <!-- TAB: Store Health                                                   -->
    <!-- ================================================================== -->
    <div id="tab-store" class="shelf-tab-panel shelf-tab-panel--hidden" role="tabpanel">
        <div class="shelf-panel-grid">

            <!-- Conversion Funnel -->
            <div class="shelf-card shelf-card--full">
                <h2><?php esc_html_e( 'Conversion Funnel', 'shelf-woocommerce' ); ?></h2>
                <div id="shelf-funnel" class="shelf-funnel-container">
                    <div class="shelf-loading">
                        <span class="shelf-spinner"></span>
                        <?php esc_html_e( 'Loading funnel…', 'shelf-woocommerce' ); ?>
                    </div>
                </div>
            </div>

            <!-- Abandoned Products -->
            <div class="shelf-card shelf-card--half">
                <h2><?php esc_html_e( 'Most Abandoned Products', 'shelf-woocommerce' ); ?></h2>
                <div class="shelf-table-wrap">
                    <table id="shelf-abandon-products" class="widefat shelf-data-table">
                        <thead>
                            <tr>
                                <th><?php esc_html_e( 'Product', 'shelf-woocommerce' ); ?></th>
                                <th><?php esc_html_e( 'Abandons', 'shelf-woocommerce' ); ?></th>
                                <th><?php esc_html_e( 'Cart Rate', 'shelf-woocommerce' ); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="shelf-loading-row">
                                <td colspan="3">
                                    <span class="shelf-spinner"></span>
                                    <?php esc_html_e( 'Loading…', 'shelf-woocommerce' ); ?>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Top Sellers -->
            <div class="shelf-card shelf-card--half">
                <h2><?php esc_html_e( 'Top Sellers', 'shelf-woocommerce' ); ?></h2>
                <div class="shelf-table-wrap">
                    <table id="shelf-top-sellers" class="widefat shelf-data-table">
                        <thead>
                            <tr>
                                <th><?php esc_html_e( 'Product', 'shelf-woocommerce' ); ?></th>
                                <th><?php esc_html_e( 'Units Sold', 'shelf-woocommerce' ); ?></th>
                                <th><?php esc_html_e( 'Revenue', 'shelf-woocommerce' ); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="shelf-loading-row">
                                <td colspan="3">
                                    <span class="shelf-spinner"></span>
                                    <?php esc_html_e( 'Loading…', 'shelf-woocommerce' ); ?>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div><!-- .shelf-panel-grid -->
    </div><!-- #tab-store -->

    <!-- ================================================================== -->
    <!-- TAB: Activity                                                       -->
    <!-- ================================================================== -->
    <div id="tab-activity" class="shelf-tab-panel shelf-tab-panel--hidden" role="tabpanel">
        <div class="shelf-panel-grid">

            <!-- 24hr Activity Chart -->
            <div class="shelf-card shelf-card--full">
                <h2><?php esc_html_e( '24-Hour Traffic Heatmap', 'shelf-woocommerce' ); ?></h2>
                <div class="shelf-chart-wrap">
                    <canvas id="shelf-activity-chart" width="900" height="300" aria-label="<?php esc_attr_e( '24-hour activity chart', 'shelf-woocommerce' ); ?>" role="img"></canvas>
                </div>
            </div>

            <!-- Peak Hours -->
            <div class="shelf-card shelf-card--full">
                <h2><?php esc_html_e( 'Peak Hours', 'shelf-woocommerce' ); ?></h2>
                <div id="shelf-peak-hours" class="shelf-peak-container">
                    <div class="shelf-loading">
                        <span class="shelf-spinner"></span>
                        <?php esc_html_e( 'Calculating peak hours…', 'shelf-woocommerce' ); ?>
                    </div>
                </div>
            </div>

        </div><!-- .shelf-panel-grid -->
    </div><!-- #tab-activity -->

</div><!-- .shelf-wrap -->
