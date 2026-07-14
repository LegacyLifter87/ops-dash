<?php
/**
 * Plugin Name: Ops Dash Connector
 * Description: Connects this site to the Ops Dash SEO platform. Receives AI-drafted blog posts and SEO metadata (titles, meta descriptions, JSON-LD schema) pushed from your Ops Dash dashboard. Content arrives as drafts unless your dashboard says otherwise. Works with Yoast, Rank Math, and All in One SEO — or standalone.
 * Version: 1.0.0
 * Author: Legacy Sales Engineering
 * License: GPLv2 or later
 */

if (!defined('ABSPATH')) exit;

define('OPSDASH_VERSION', '1.0.0');

// ---------------------------------------------------------------------------
// Settings page: paste the connection key generated in the Ops Dash portal.
// ---------------------------------------------------------------------------
add_action('admin_menu', function () {
	add_options_page('Ops Dash Connector', 'Ops Dash', 'manage_options', 'opsdash', 'opsdash_settings_page');
});
add_action('admin_init', function () {
	register_setting('opsdash', 'opsdash_key', ['sanitize_callback' => 'sanitize_text_field']);
});
function opsdash_settings_page() { ?>
	<div class="wrap">
		<h1>Ops Dash Connector</h1>
		<p>Paste the connection key from your Ops Dash portal (Keywords &rarr; Briefs &rarr; WordPress publishing).</p>
		<form method="post" action="options.php">
			<?php settings_fields('opsdash'); ?>
			<input type="text" name="opsdash_key" value="<?php echo esc_attr(get_option('opsdash_key', '')); ?>" style="width:440px" placeholder="opsd_..." autocomplete="off" />
			<?php submit_button('Save key'); ?>
		</form>
		<p>Status: <?php echo get_option('opsdash_key')
			? '<strong style="color:green">Key saved.</strong> Finish connecting from the Ops Dash portal (it will show &ldquo;Connected&rdquo; once it can reach this site).'
			: '<em>No key saved yet.</em>'; ?></p>
		<p style="color:#666">Detected SEO plugin: <strong><?php echo esc_html(opsdash_seo_plugin()); ?></strong>
			<?php if (opsdash_seo_plugin() === 'none') echo ' &mdash; Ops Dash will output SEO titles, meta descriptions, and schema itself.'; ?></p>
	</div>
<?php }

// ---------------------------------------------------------------------------
// Auth: every REST call must carry the connection key.
// ---------------------------------------------------------------------------
function opsdash_auth($request) {
	$stored = (string) get_option('opsdash_key', '');
	$given  = (string) $request->get_header('x-opsdash-key');
	if ($stored === '' || $given === '') return false;
	return hash_equals($stored, $given);
}

// ---------------------------------------------------------------------------
// SEO plugin detection + metadata writing (Yoast / Rank Math / AIOSEO / own).
// ---------------------------------------------------------------------------
function opsdash_seo_plugin() {
	if (defined('WPSEO_VERSION')) return 'yoast';
	if (class_exists('RankMath')) return 'rankmath';
	if (defined('AIOSEO_VERSION')) return 'aioseo';
	return 'none';
}

function opsdash_set_seo_meta($post_id, $seo_title, $meta_desc) {
	$which = opsdash_seo_plugin();
	if ($seo_title !== '') {
		if ($which === 'yoast')      update_post_meta($post_id, '_yoast_wpseo_title', $seo_title);
		elseif ($which === 'rankmath') update_post_meta($post_id, 'rank_math_title', $seo_title);
		elseif ($which === 'aioseo')   update_post_meta($post_id, '_aioseo_title', $seo_title);
		update_post_meta($post_id, '_opsdash_seo_title', $seo_title);
	}
	if ($meta_desc !== '') {
		if ($which === 'yoast')      update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_desc);
		elseif ($which === 'rankmath') update_post_meta($post_id, 'rank_math_description', $meta_desc);
		elseif ($which === 'aioseo')   update_post_meta($post_id, '_aioseo_description', $meta_desc);
		update_post_meta($post_id, '_opsdash_meta_desc', $meta_desc);
	}
}

function opsdash_set_schema($post_id, $schema) {
	// Accept a JSON string or an already-decoded structure; store re-encoded JSON only.
	$decoded = is_string($schema) ? json_decode($schema, true) : $schema;
	if ($decoded) update_post_meta($post_id, '_opsdash_schema', wp_json_encode($decoded));
}

// Fallback head output when no SEO plugin is installed, plus JSON-LD for all setups.
add_filter('pre_get_document_title', function ($title) {
	if (is_singular() && opsdash_seo_plugin() === 'none') {
		$t = get_post_meta(get_queried_object_id(), '_opsdash_seo_title', true);
		if ($t) return $t;
	}
	return $title;
}, 20);

add_action('wp_head', function () {
	if (!is_singular()) return;
	$pid = get_queried_object_id();
	if (opsdash_seo_plugin() === 'none') {
		$d = get_post_meta($pid, '_opsdash_meta_desc', true);
		if ($d) echo '<meta name="description" content="' . esc_attr($d) . '" />' . "\n";
	}
	$schema = get_post_meta($pid, '_opsdash_schema', true);
	if ($schema) {
		$decoded = json_decode($schema, true);
		if ($decoded) echo '<script type="application/ld+json">' . wp_json_encode($decoded) . '</script>' . "\n";
	}
});

// ---------------------------------------------------------------------------
// REST API: /wp-json/opsdash/v1/*
// ---------------------------------------------------------------------------
add_action('rest_api_init', function () {

	register_rest_route('opsdash/v1', '/status', [
		'methods' => 'GET',
		'permission_callback' => 'opsdash_auth',
		'callback' => function () {
			$counts = wp_count_posts();
			return [
				'ok' => true,
				'plugin_version' => OPSDASH_VERSION,
				'site_name' => get_bloginfo('name'),
				'wp_version' => get_bloginfo('version'),
				'seo_plugin' => opsdash_seo_plugin(),
				'posts_published' => (int) $counts->publish,
				'url' => home_url(),
			];
		},
	]);

	register_rest_route('opsdash/v1', '/pages', [
		'methods' => 'GET',
		'permission_callback' => 'opsdash_auth',
		'callback' => function () {
			$items = get_posts(['post_type' => ['post', 'page'], 'post_status' => 'publish', 'numberposts' => 200, 'orderby' => 'modified', 'order' => 'DESC']);
			return array_map(function ($p) {
				return ['id' => $p->ID, 'type' => $p->post_type, 'title' => $p->post_title, 'url' => get_permalink($p)];
			}, $items);
		},
	]);

	// Publish (or re-publish via update_id) a piece of content drafted in Ops Dash.
	register_rest_route('opsdash/v1', '/publish', [
		'methods' => 'POST',
		'permission_callback' => 'opsdash_auth',
		'callback' => 'opsdash_publish',
	]);

	// Apply SEO metadata to an EXISTING post/page (by ID or public URL).
	register_rest_route('opsdash/v1', '/update-seo', [
		'methods' => 'POST',
		'permission_callback' => 'opsdash_auth',
		'callback' => 'opsdash_update_seo',
	]);
});

function opsdash_publish(WP_REST_Request $req) {
	$p = $req->get_json_params();
	$title   = sanitize_text_field($p['title'] ?? '');
	$content = wp_kses_post((string) ($p['content_html'] ?? ''));
	if ($title === '' || $content === '') return new WP_Error('opsdash_bad_request', 'title and content_html are required', ['status' => 400]);

	$status = (($p['status'] ?? 'draft') === 'publish') ? 'publish' : 'draft';
	$type   = (($p['type'] ?? 'post') === 'page') ? 'page' : 'post';

	$args = [
		'post_title'   => $title,
		'post_content' => $content,
		'post_status'  => $status,
		'post_type'    => $type,
	];
	if (!empty($p['slug']))    $args['post_name']    = sanitize_title($p['slug']);
	if (!empty($p['excerpt'])) $args['post_excerpt'] = sanitize_text_field($p['excerpt']);
	if (!empty($p['update_id'])) {
		$existing = get_post((int) $p['update_id']);
		if ($existing) $args['ID'] = (int) $p['update_id'];
	}

	$post_id = wp_insert_post($args, true);
	if (is_wp_error($post_id)) return $post_id;

	opsdash_set_seo_meta($post_id, sanitize_text_field($p['seo_title'] ?? ''), sanitize_text_field($p['meta_description'] ?? ''));
	if (!empty($p['schema_jsonld'])) opsdash_set_schema($post_id, $p['schema_jsonld']);

	return [
		'ok' => true,
		'post_id' => $post_id,
		'status' => $status,
		'link' => get_permalink($post_id),
		'edit_link' => admin_url('post.php?post=' . $post_id . '&action=edit'),
	];
}

function opsdash_update_seo(WP_REST_Request $req) {
	$p = $req->get_json_params();
	$post_id = 0;
	if (!empty($p['post_id']))  $post_id = (int) $p['post_id'];
	elseif (!empty($p['url']))  $post_id = url_to_postid(esc_url_raw($p['url']));
	if (!$post_id || !get_post($post_id)) return new WP_Error('opsdash_not_found', 'post not found for that id/url', ['status' => 404]);

	opsdash_set_seo_meta($post_id, sanitize_text_field($p['seo_title'] ?? ''), sanitize_text_field($p['meta_description'] ?? ''));
	if (!empty($p['schema_jsonld'])) opsdash_set_schema($post_id, $p['schema_jsonld']);

	return ['ok' => true, 'post_id' => $post_id, 'link' => get_permalink($post_id)];
}
