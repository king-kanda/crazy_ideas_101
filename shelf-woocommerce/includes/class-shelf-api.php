<?php
/**
 * Shelf API — low-level HTTP client.
 *
 * @package Shelf_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Shelf_API {

    /**
     * Return the saved API key.
     *
     * @return string
     */
    public static function get_api_key(): string {
        return (string) get_option( 'shelf_api_key', '' );
    }

    /**
     * Return the saved store ID.
     *
     * @return string
     */
    public static function get_store_id(): string {
        return (string) get_option( 'shelf_store_id', '' );
    }

    /**
     * Return the configured API base URL, falling back to the compile-time constant.
     *
     * @return string
     */
    public static function get_api_url(): string {
        return rtrim( (string) get_option( 'shelf_api_url', SHELF_API_URL ), '/' );
    }

    /**
     * POST JSON data to a Shelf API endpoint.
     *
     * @param string $endpoint  e.g. '/ingest/products'
     * @param array  $data      Payload to JSON-encode.
     * @return array            Decoded response body, or ['error' => '...'].
     */
    public static function post( string $endpoint, array $data ): array {
        $api_key = self::get_api_key();
        if ( '' === $api_key ) {
            return [ 'error' => 'API key is not configured.' ];
        }

        $url      = self::get_api_url() . '/' . ltrim( $endpoint, '/' );
        $response = wp_remote_post(
            $url,
            [
                'timeout'     => 30,
                'redirection' => 5,
                'headers'     => [
                    'Content-Type'    => 'application/json',
                    'X-Shelf-API-Key' => $api_key,
                    'X-Shelf-Site-URL' => get_site_url(),
                    'Accept'          => 'application/json',
                ],
                'body'        => wp_json_encode( $data ),
            ]
        );

        return self::parse_response( $response );
    }

    /**
     * GET a Shelf API endpoint, optionally overriding the API key.
     *
     * @param string $endpoint  e.g. '/auth/verify'
     * @param string $api_key   Optional override (used during settings save).
     * @return array            Decoded response body, or ['error' => '...'].
     */
    public static function get( string $endpoint, string $api_key = '' ): array {
        if ( '' === $api_key ) {
            $api_key = self::get_api_key();
        }
        if ( '' === $api_key ) {
            return [ 'error' => 'API key is not configured.' ];
        }

        $url      = self::get_api_url() . '/' . ltrim( $endpoint, '/' );
        $response = wp_remote_get(
            $url,
            [
                'timeout'     => 30,
                'redirection' => 5,
                'headers'     => [
                    'X-Shelf-API-Key' => $api_key,
                    'Accept'          => 'application/json',
                ],
            ]
        );

        return self::parse_response( $response );
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Parse a WP HTTP API response into an associative array.
     *
     * @param array|WP_Error $response
     * @return array
     */
    private static function parse_response( $response ): array {
        if ( is_wp_error( $response ) ) {
            return [ 'error' => $response->get_error_message() ];
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );

        if ( empty( $body ) ) {
            if ( $code >= 200 && $code < 300 ) {
                return [ 'success' => true, 'status' => $code ];
            }
            return [ 'error' => "HTTP {$code}: empty response." ];
        }

        $decoded = json_decode( $body, true );

        if ( null === $decoded && JSON_ERROR_NONE !== json_last_error() ) {
            return [ 'error' => 'Invalid JSON response from API.' ];
        }

        if ( $code < 200 || $code >= 300 ) {
            $message = isset( $decoded['message'] ) ? $decoded['message'] : "HTTP {$code}";
            return [ 'error' => $message ];
        }

        return is_array( $decoded ) ? $decoded : [ 'data' => $decoded ];
    }
}
