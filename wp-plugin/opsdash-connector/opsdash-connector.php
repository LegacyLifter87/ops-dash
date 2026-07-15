<?php
/**
 * Plugin Name: Ops Dash Connector
 * Description: Connects this site to the Ops Dash SEO platform. Receives AI-drafted blog posts and SEO metadata (titles, meta descriptions, JSON-LD schema) pushed from your Ops Dash dashboard. Content arrives as drafts unless your dashboard says otherwise. Works with Yoast, Rank Math, and All in One SEO — or standalone.
 * Version: 1.4.0
 * Author: Legacy Sales Engineering
 * License: GPLv2 or later
 */

if (!defined('ABSPATH')) exit;

define('OPSDASH_VERSION', '1.4.0');

// Post types this plugin is ever allowed to create or modify. Everything else
// on the site (products, templates, attachments, menu items) is off limits.
function opsdash_allowed_types() { return ['post', 'page']; }

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
			<input type="password" name="opsdash_key" value="<?php echo esc_attr(get_option('opsdash_key', '')); ?>" style="width:440px" placeholder="opsd_..." autocomplete="off" />
			<?php submit_button('Save key'); ?>
		</form>
		<p>Status: <?php echo get_option('opsdash_key')
			? '<strong style="color:green">Key saved.</strong> Finish connecting from the Ops Dash portal (it will show &ldquo;Connected&rdquo; once it can reach this site).'
			: '<em>No key saved yet.</em>'; ?></p>
		<p style="color:#666">This key lets Ops Dash create and edit <strong>posts and pages only</strong>. It cannot add users, change settings, install plugins, or touch anything else on the site. If it is ever exposed, click <em>Regenerate key</em> in the Ops Dash portal and paste the new one here &mdash; the old key stops working immediately.</p>
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
	if ($decoded) update_post_meta($post_id, '_opsdash_schema', opsdash_json($decoded));
}

// JSON encoded for safe embedding inside a <script> block. Without JSON_HEX_TAG
// the only thing preventing a `</script>` break-out is PHP's default escaping of
// forward slashes — one flag away from stored XSS on every page view. These
// flags encode < > & ' " as \uXXXX so the payload can never close the tag.
function opsdash_json($data) {
	return wp_json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
}

// Fallback head output when no SEO plugin is installed, plus JSON-LD for all setups.
add_filter('pre_get_document_title', function ($title) {
	if (is_singular() && opsdash_seo_plugin() === 'none') {
		$t = get_post_meta(get_queried_object_id(), '_opsdash_seo_title', true);
		// esc_html here is deliberate: wp_get_document_title() returns as soon as
		// this filter is non-empty, skipping the esc_html() it would otherwise
		// apply, and _wp_render_title_tag() echoes the result unescaped.
		if ($t) return esc_html($t);
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
		if ($decoded) echo '<script type="application/ld+json">' . opsdash_json($decoded) . '</script>' . "\n";
	}
	// Canonical fix: only set for pages the audit flagged as missing one.
	$canon = get_post_meta($pid, '_opsdash_canonical', true);
	if ($canon) echo '<link rel="canonical" href="' . esc_url($canon) . '" />' . "\n";
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

	// Apply alt text to images: sets attachment alt meta (which Elementor and
	// most builders read) and patches inline alt attributes in post_content.
	register_rest_route('opsdash/v1', '/fix-alts', [
		'methods' => 'POST',
		'permission_callback' => 'opsdash_auth',
		'callback' => 'opsdash_fix_alts',
	]);

	// Demote extra H1s in post_content to H2 (skips builder-managed pages).
	register_rest_route('opsdash/v1', '/fix-h1', [
		'methods' => 'POST',
		'permission_callback' => 'opsdash_auth',
		'callback' => 'opsdash_fix_h1',
	]);
});

// Resolve a target post from {post_id|url}, refusing anything that isn't a
// post/page so no endpoint can touch products, templates or attachments.
function opsdash_resolve_post($p) {
	$id = 0;
	if (!empty($p['post_id'])) $id = (int) $p['post_id'];
	elseif (!empty($p['url'])) $id = url_to_postid(esc_url_raw($p['url']));
	if (!$id) return 0;
	$post = get_post($id);
	if (!$post || !in_array($post->post_type, opsdash_allowed_types(), true)) return 0;
	return $id;
}

// Resolve an image URL to its attachment ID, tolerating -300x200 size suffixes.
function opsdash_attachment_from_src($src) {
	$id = attachment_url_to_postid($src);
	if ($id) return $id;
	$stripped = preg_replace('/-\d+x\d+(\.[a-z]{3,4})(\?.*)?$/i', '$1', $src);
	if ($stripped !== $src) { $id = attachment_url_to_postid($stripped); if ($id) return $id; }
	return 0;
}

function opsdash_fix_alts(WP_REST_Request $req) {
	$p = $req->get_json_params();
	$post_id = opsdash_resolve_post($p);
	if (!$post_id) return new WP_Error('opsdash_not_found', 'no post or page found for that id/url', ['status' => 404]);
	$alts = is_array($p['alts'] ?? null) ? $p['alts'] : [];
	if (!$alts) return new WP_Error('opsdash_bad_request', 'alts[] required', ['status' => 400]);
	$attachments = 0; $content_hits = 0;
	$content = $post_id ? get_post_field('post_content', $post_id) : '';
	foreach (array_slice($alts, 0, 30) as $a) {
		$src = esc_url_raw($a['src'] ?? '');
		$alt = sanitize_text_field($a['alt'] ?? '');
		if (!$src || $alt === '') continue;
		$att = opsdash_attachment_from_src($src);
		if ($att) { update_post_meta($att, '_wp_attachment_image_alt', $alt); $attachments++; }
		if ($content) {
			$content = preg_replace_callback('/<img\b[^>]*>/i', function ($m) use ($src, $alt, &$content_hits) {
				$tag = $m[0];
				if (strpos($tag, esc_url($src)) === false && strpos($tag, $src) === false) return $tag;
				$content_hits++;
				if (preg_match('/\balt=["\'][^"\']*["\']/i', $tag)) return preg_replace('/\balt=["\'][^"\']*["\']/i', 'alt="' . esc_attr($alt) . '"', $tag);
				return preg_replace('/<img\b/i', '<img alt="' . esc_attr($alt) . '"', $tag, 1);
			}, $content);
		}
	}
	if ($post_id && $content_hits) wp_update_post(['ID' => $post_id, 'post_content' => $content]);
	return ['ok' => true, 'post_id' => $post_id, 'attachments_updated' => $attachments, 'content_imgs_updated' => $content_hits];
}

function opsdash_fix_h1(WP_REST_Request $req) {
	$p = $req->get_json_params();
	$post_id = opsdash_resolve_post($p);
	if (!$post_id) return new WP_Error('opsdash_not_found', 'post not found for that id/url', ['status' => 404]);
	if (get_post_meta($post_id, '_elementor_data', true)) return ['ok' => true, 'skipped' => 'elementor', 'note' => 'Page is built with Elementor — extra H1s live in the builder and must be demoted there.'];
	$content = get_post_field('post_content', $post_id);
	$seen = 0;
	$new = preg_replace_callback('/<(\/?)h1(\b[^>]*)>/i', function ($m) use (&$seen) {
		if ($m[1] === '') { $seen++; return $seen > 1 ? '<h2' . $m[2] . '>' : $m[0]; }
		return $seen > 1 ? '</h2>' : $m[0];
	}, $content);
	$changed = ($new !== $content);
	if ($changed) wp_update_post(['ID' => $post_id, 'post_content' => $new]);
	return ['ok' => true, 'post_id' => $post_id, 'changed' => $changed, 'h1_found' => $seen];
}

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
		// Only ever update a post/page. Without this, an update_id pointing at a
		// product, builder template, attachment or menu item would be silently
		// CONVERTED into a post by wp_insert_post — destroying it.
		if (!$existing || !in_array($existing->post_type, opsdash_allowed_types(), true)) {
			return new WP_Error('opsdash_bad_target', 'update_id must reference a post or page', ['status' => 400]);
		}
		$args['ID'] = (int) $p['update_id'];
	}

	$post_id = wp_insert_post($args, true);
	if (is_wp_error($post_id)) return $post_id;

	opsdash_set_seo_meta($post_id, sanitize_text_field($p['seo_title'] ?? ''), sanitize_text_field($p['meta_description'] ?? ''));
	if (!empty($p['schema_jsonld'])) opsdash_set_schema($post_id, $p['schema_jsonld']);

	$featured = null;
	if (!empty($p['featured_image_url'])) {
		$img = opsdash_sideload_featured($post_id, $p['featured_image_url'], $p['featured_image_alt'] ?? '');
		$featured = is_wp_error($img) ? ['error' => $img->get_error_message()] : ['attachment_id' => $img];
	}

	// Inline article images: each {marker, alt, url | data_base64+mime}. The marker
	// token is replaced in the post content with proper figure markup; the first
	// image becomes the featured image when none was set explicitly.
	$img_results = [];
	if (!empty($p['images']) && is_array($p['images'])) {
		$content2 = get_post_field('post_content', $post_id);
		$first_att = 0;
		foreach (array_slice($p['images'], 0, 8) as $img) {
			if (!is_array($img)) continue;
			$att = opsdash_attach_image($post_id, $img);
			if (is_wp_error($att)) { $img_results[] = ['marker' => $img['marker'] ?? '', 'error' => $att->get_error_message()]; continue; }
			$src = wp_get_attachment_image_url($att, 'large');
			if (!$src) $src = wp_get_attachment_url($att);
			$fig = '<figure class="wp-block-image size-large"><img src="' . esc_url($src) . '" alt="' . esc_attr($img['alt'] ?? '') . '" /></figure>';
			if (!empty($img['marker']) && strpos($content2, $img['marker']) !== false) {
				$content2 = str_replace($img['marker'], $fig, $content2);
			}
			if (!$first_att) $first_att = $att;
			$img_results[] = ['marker' => $img['marker'] ?? '', 'attachment_id' => $att];
		}
		wp_update_post(['ID' => $post_id, 'post_content' => $content2]);
		if ($first_att && !has_post_thumbnail($post_id)) set_post_thumbnail($post_id, $first_att);
	}

	return [
		'ok' => true,
		'post_id' => $post_id,
		'status' => $status,
		'link' => get_permalink($post_id),
		'edit_link' => admin_url('post.php?post=' . $post_id . '&action=edit'),
		'featured_image' => $featured,
		'images' => $img_results,
	];
}

// Attach one image (remote URL or base64 payload) to the media library.
function opsdash_attach_image($post_id, $img) {
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$att = null;
	if (!empty($img['url'])) {
		$att = media_sideload_image(esc_url_raw($img['url']), $post_id, sanitize_text_field($img['alt'] ?? ''), 'id');
		if (is_wp_error($att)) return $att;
	} elseif (!empty($img['data_base64'])) {
		$bits = base64_decode($img['data_base64'], true);
		if ($bits === false) return new WP_Error('opsdash_b64', 'invalid base64 image data');
		$mime = in_array($img['mime'] ?? '', ['image/png', 'image/jpeg', 'image/webp'], true) ? $img['mime'] : 'image/jpeg';
		$ext = $mime === 'image/png' ? 'png' : ($mime === 'image/webp' ? 'webp' : 'jpg');
		$up = wp_upload_bits('opsdash-' . substr(md5($img['data_base64']), 0, 10) . '.' . $ext, null, $bits);
		if (!empty($up['error'])) return new WP_Error('opsdash_upload', $up['error']);
		$att = wp_insert_attachment([
			'post_mime_type' => $mime,
			'post_title' => sanitize_text_field($img['alt'] ?? 'Image'),
			'post_status' => 'inherit',
		], $up['file'], $post_id);
		if (is_wp_error($att)) return $att;
		wp_update_attachment_metadata($att, wp_generate_attachment_metadata($att, $up['file']));
	} else {
		return new WP_Error('opsdash_noimg', 'image needs url or data_base64');
	}
	if (!empty($img['alt'])) update_post_meta($att, '_wp_attachment_image_alt', sanitize_text_field($img['alt']));
	return $att;
}

// Download an image from a URL into the media library and set it as the
// post's featured image. Failures here never fail the publish itself.
function opsdash_sideload_featured($post_id, $url, $alt) {
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$att_id = media_sideload_image(esc_url_raw($url), $post_id, null, 'id');
	if (is_wp_error($att_id)) return $att_id;
	set_post_thumbnail($post_id, $att_id);
	if ($alt !== '') update_post_meta($att_id, '_wp_attachment_image_alt', sanitize_text_field($alt));
	return $att_id;
}

function opsdash_update_seo(WP_REST_Request $req) {
	$p = $req->get_json_params();
	$post_id = opsdash_resolve_post($p);
	if (!$post_id) return new WP_Error('opsdash_not_found', 'no post or page found for that id/url', ['status' => 404]);

	opsdash_set_seo_meta($post_id, sanitize_text_field($p['seo_title'] ?? ''), sanitize_text_field($p['meta_description'] ?? ''));
	if (!empty($p['schema_jsonld'])) opsdash_set_schema($post_id, $p['schema_jsonld']);
	if (!empty($p['canonical'])) update_post_meta($post_id, '_opsdash_canonical', esc_url_raw($p['canonical']));

	return ['ok' => true, 'post_id' => $post_id, 'link' => get_permalink($post_id)];
}
