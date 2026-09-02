<?php
/**
 * Plugin Name: Ops Dash Connector
 * Description: Connects this site to the Ops Dash SEO platform. Receives AI-drafted blog posts and SEO metadata (titles, meta descriptions, JSON-LD schema) pushed from your Ops Dash dashboard. Content arrives as drafts unless your dashboard says otherwise. Works with Yoast, Rank Math, and All in One SEO — or standalone.
 * Version: 1.9.4
 * Author: Legacy Sales Engineering
 * License: GPLv2 or later
 * Update URI: https://ops.legacybuilder.app/opsdash-connector
 */

if (!defined('ABSPATH')) exit;

// ---------------------------------------------------------------------------
// Cleanup of debris from the malformed 1.5.0/1.6.0 packages. Those zips had
// backslash entry names, so Linux extracted a single file with a literal '\'
// in its name instead of a folder — and because the zip then had no top-level
// folder, WordPress created a folder NAMED AFTER EACH ZIP (opsdash-connector-
// 1.5.0, opsdash-connector-1.6.0, ...). Sites collected several half-broken
// copies, fresh installs collided with the leftovers ("destination folder
// already exists"), and duplicates piled up. This removes every Ops Dash
// Connector copy that is not the one whose code is running.
//
// This block sits ABOVE the duplicate-load bail on purpose: even when a stale
// copy loaded first and "wins" this request, the cleanup must still register
// so the stale copies get deleted. Guarded with function_exists so a second
// 1.6.2+ copy loading cannot fatal on redeclare.
// ---------------------------------------------------------------------------
if (!function_exists('opsdash_cleanup_stale_copies')) {
	function opsdash_rrmdir($dir) {
		$items = @scandir($dir);
		if ($items === false) return;
		foreach ($items as $it) {
			if ($it === '.' || $it === '..') continue;
			$p = $dir . '/' . $it;
			if (is_dir($p) && !is_link($p)) opsdash_rrmdir($p);
			else @unlink($p);
		}
		@rmdir($dir);
	}

	function opsdash_cleanup_stale_copies() {
		$root = wp_normalize_path(untrailingslashit(WP_PLUGIN_DIR));
		$entries = @scandir($root);
		if ($entries === false) return;
		// Self-identity via realpath BOTH ways. String comparison here is not
		// enough: on hosts that symlink wp-content (Pantheon, WP Engine, ...)
		// __FILE__ is the RESOLVED path while WP_PLUGIN_DIR keeps the symlinked
		// one — a naive compare failed to recognise the plugin's own folder and
		// deleted it during activation ("Plugin file does not exist.").
		$self_real = @realpath(dirname(__FILE__));
		$removed_dirs = [];
		foreach ($entries as $entry) {
			if ($entry === '.' || $entry === '..') continue;
			$path = $root . '/' . $entry;
			// 1) Stray FILES from the malformed zips — a name that starts with our
			//    slug and contains a literal backslash is unambiguously our debris.
			if (is_file($path) && strpos($entry, 'opsdash-connector') === 0 && strpos($entry, '\\') !== false) {
				@unlink($path);
				continue;
			}
			// 2) Duplicate FOLDERS from the bad zips (opsdash-connector-1.6.0 etc.).
			//    THREE hard rules: (a) the canonical 'opsdash-connector' folder is
			//    NEVER deleted, only suffixed duplicates; (b) a folder whose real
			//    path is the running copy's real path is never deleted; (c) only
			//    folders positively identified by our plugin header are deleted.
			if (is_dir($path) && preg_match('/^opsdash-connector[-._]/', $entry)) {
				$real = @realpath($path);
				if ($self_real && $real && $real === $self_real) continue;
				$is_ours = false;
				foreach ((array) @scandir($path) as $f) {
					if ($f === '.' || $f === '..') continue;
					if (substr($f, -4) !== '.php') continue;
					$head = (string) @file_get_contents($path . '/' . $f, false, null, 0, 600);
					if (strpos($head, 'Plugin Name: Ops Dash Connector') !== false) { $is_ours = true; break; }
				}
				if (!$is_ours) continue;
				opsdash_rrmdir($path);
				$removed_dirs[] = $entry;
			}
		}
		// Drop active_plugins entries that pointed into the folders we just removed,
		// so WordPress doesn't show "plugin file does not exist" errors afterwards.
		if ($removed_dirs) {
			$active = (array) get_option('active_plugins', []);
			$keep = array_values(array_filter($active, function ($pb) use ($removed_dirs) {
				$top = strtok((string) $pb, '/');
				return !in_array($top, $removed_dirs, true);
			}));
			if ($keep !== $active) update_option('active_plugins', $keep);
		}
	}

	add_action('admin_init', function () {
		if (get_option('opsdash_cleanup_ran') !== '1.7.0') {
			opsdash_cleanup_stale_copies();
			update_option('opsdash_cleanup_ran', '1.7.0');
		}
	});
}
// On activation, only SCHEDULE the cleanup (next admin page load) rather than
// deleting anything while WordPress is mid-activation — nothing can disappear
// out from under the request that is activating the plugin.
register_activation_hook(__FILE__, function () { delete_option('opsdash_cleanup_ran'); });

// If a second copy of this plugin is present (a stray folder left behind by a
// failed update, or a duplicate upload), loading it again would fatal the whole
// site with "Cannot redeclare opsdash_auth()". Bail out quietly instead — the
// first copy stays in charge and the site keeps working.
if (defined('OPSDASH_VERSION')) return;

define('OPSDASH_VERSION', '1.9.4');
// Pairing-code exchange endpoint: the plugin trades the short code the user
// typed for the real connection key, server-to-server. Public endpoint; codes
// are single-use, 15-minute, host-locked, and rate-limited server-side.
define('OPSDASH_PAIR_URL', 'https://dkecnwmzlvwbhnnfompn.supabase.co/functions/v1/seo-wp-pair');
define('OPSDASH_UPDATE_MANIFEST', 'https://ops.legacybuilder.app/plugin-update.json');
// Any update package must come from this exact HTTPS origin. Without this a
// tampered manifest could point WordPress at an arbitrary zip and install it.
define('OPSDASH_PACKAGE_ORIGIN', 'https://ops.legacybuilder.app/');

// ---------------------------------------------------------------------------
// Self-updating: because the plugin header above declares an "Update URI" whose
// host is not wordpress.org, WordPress 5.8+ hands the update check for THIS
// plugin to the filter below instead of querying the .org repository.
// ---------------------------------------------------------------------------
function opsdash_remote_manifest() {
	$cached = get_transient('opsdash_update_manifest');
	if ($cached !== false) return is_array($cached) ? $cached : [];
	$res = wp_remote_get(OPSDASH_UPDATE_MANIFEST, ['timeout' => 8, 'headers' => ['Accept' => 'application/json']]);
	$data = [];
	if (!is_wp_error($res) && (int) wp_remote_retrieve_response_code($res) === 200) {
		$decoded = json_decode(wp_remote_retrieve_body($res), true);
		if (is_array($decoded)) $data = $decoded;
	}
	// Refuse anything not served from our own origin.
	if (!empty($data['package']) && stripos((string) $data['package'], OPSDASH_PACKAGE_ORIGIN) !== 0) $data = [];
	// Short cache on failure so a blip doesn't stall updates for hours.
	set_transient('opsdash_update_manifest', $data, $data ? HOUR_IN_SECONDS : 15 * MINUTE_IN_SECONDS);
	return $data;
}

// A manual "Check Again" on Dashboard → Updates must see the newest release
// immediately — WordPress re-runs the update check, but our filter would
// otherwise answer from the cached manifest. Bust it on forced checks.
add_action('load-update-core.php', function () {
	if (isset($_GET['force-check'])) delete_transient('opsdash_update_manifest');
});

add_filter('update_plugins_ops.legacybuilder.app', function ($update, $plugin_data, $plugin_file, $locales) {
	if ($plugin_file !== plugin_basename(__FILE__)) return $update;
	$info = opsdash_remote_manifest();
	if (empty($info['version']) || empty($info['package'])) return $update;
	if (version_compare((string) $info['version'], OPSDASH_VERSION, '<=')) return $update;
	return [
		'slug'         => 'opsdash-connector',
		'version'      => (string) $info['version'],
		'url'          => (string) ($info['url'] ?? 'https://ops.legacybuilder.app'),
		'package'      => (string) $info['package'],
		'tested'       => (string) ($info['tested'] ?? ''),
		'requires_php' => (string) ($info['requires_php'] ?? ''),
	];
}, 10, 4);

// Install those updates unattended. Kill switch for a specific site: drop
// add_filter('opsdash_allow_auto_update', '__return_false'); into a mu-plugin.
add_filter('auto_update_plugin', function ($update, $item) {
	if (!empty($item->plugin) && $item->plugin === plugin_basename(__FILE__)) {
		return (bool) apply_filters('opsdash_allow_auto_update', true);
	}
	return $update;
}, 10, 2);

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
function opsdash_settings_page() {
	$msg = isset($_GET['opsdash_msg']) ? sanitize_text_field(wp_unslash($_GET['opsdash_msg'])) : ''; ?>
	<div class="wrap">
		<h1>Ops Dash Connector</h1>
		<?php if ($msg === 'paired') : ?>
			<div class="notice notice-success"><p><strong>Connected!</strong> This site is now linked to your Ops Dash portal &mdash; the portal will show it as connected within a few seconds.</p></div>
		<?php elseif ($msg !== '') : ?>
			<div class="notice notice-error"><p><?php echo esc_html($msg); ?></p></div>
		<?php endif; ?>
		<p>Status: <?php echo get_option('opsdash_key')
			? '<strong style="color:green">Connected key saved.</strong>'
			: '<em>Not connected yet.</em>'; ?>
			&nbsp;Detected SEO plugin: <strong><?php echo esc_html(opsdash_seo_plugin()); ?></strong></p>

		<h2>Connect with a pairing code</h2>
		<p>In your Ops Dash portal, open <strong>Keywords &rarr; Briefs &rarr; WordPress publishing</strong> and click <strong>Connect</strong> &mdash; it shows an 8-character code. Enter it here:</p>
		<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
			<input type="hidden" name="action" value="opsdash_pair" />
			<?php wp_nonce_field('opsdash_pair'); ?>
			<input type="text" name="opsdash_code" style="width:220px;font-size:18px;letter-spacing:3px;text-transform:uppercase" placeholder="XXXX-XXXX" autocomplete="off" />
			<?php submit_button('Connect to Ops Dash', 'primary', 'submit', false); ?>
		</form>

		<details style="margin-top:20px">
			<summary style="cursor:pointer;color:#666">Advanced: paste a connection key manually</summary>
			<form method="post" action="options.php" style="margin-top:8px">
				<?php settings_fields('opsdash'); ?>
				<input type="password" name="opsdash_key" value="<?php echo esc_attr(get_option('opsdash_key', '')); ?>" style="width:440px" placeholder="opsd_..." autocomplete="off" />
				<?php submit_button('Save key'); ?>
			</form>
		</details>

		<p style="color:#666;margin-top:16px">The connection lets Ops Dash create and edit <strong>posts and pages only</strong>. It cannot add users, change settings, install plugins, or touch anything else on the site. Re-pairing from the Ops Dash portal invalidates the previous connection immediately.</p>
	</div>
<?php }

// Trade the typed pairing code for the real connection key, server-to-server.
add_action('admin_post_opsdash_pair', function () {
	if (!current_user_can('manage_options')) wp_die('Insufficient permissions.');
	check_admin_referer('opsdash_pair');
	$back = admin_url('options-general.php?page=opsdash');
	$code = isset($_POST['opsdash_code']) ? strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) wp_unslash($_POST['opsdash_code']))) : '';
	if (strlen($code) < 6) { wp_safe_redirect(add_query_arg('opsdash_msg', rawurlencode('Enter the pairing code shown in Ops Dash.'), $back)); exit; }
	$res = wp_remote_post(OPSDASH_PAIR_URL, [
		'timeout' => 20,
		'headers' => ['Content-Type' => 'application/json'],
		'body' => wp_json_encode([
			'action' => 'claim',
			'code' => $code,
			'site_url' => home_url(),
			'site_name' => get_bloginfo('name'),
			'plugin_version' => OPSDASH_VERSION,
			'seo_plugin' => opsdash_seo_plugin(),
			'wp_version' => get_bloginfo('version'),
		]),
	]);
	if (is_wp_error($res)) { wp_safe_redirect(add_query_arg('opsdash_msg', rawurlencode('Could not reach Ops Dash: ' . $res->get_error_message()), $back)); exit; }
	$body = json_decode((string) wp_remote_retrieve_body($res), true);
	if (!is_array($body) || empty($body['token'])) {
		$err = (is_array($body) && !empty($body['error'])) ? (string) $body['error'] : 'Pairing failed — the code may have expired. Generate a fresh one in Ops Dash and try again.';
		wp_safe_redirect(add_query_arg('opsdash_msg', rawurlencode($err), $back)); exit;
	}
	update_option('opsdash_key', sanitize_text_field((string) $body['token']));
	wp_safe_redirect(add_query_arg('opsdash_msg', 'paired', $back)); exit;
});

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

// Point a post's canonical at another URL — the fix for two posts competing
// for the same search.
//
// It MUST go into the active SEO plugin's own field. Writing our
// _opsdash_canonical while Rank Math or Yoast is installed emits a SECOND
// canonical tag alongside theirs, and Google discards conflicting canonicals
// entirely — leaving the site worse off than before, with no canonical signal
// at all. 14 of 15 connected sites run Rank Math, so this is the normal case,
// not an edge case.
//
// Returns false when the active plugin owns canonicals somewhere we cannot
// safely write (AIOSEO keeps them in its own table, not post meta), so the
// caller can report it instead of silently doing nothing.
function opsdash_set_canonical($post_id, $url) {
	$url = esc_url_raw($url);
	if (!$url) return false;
	$which = opsdash_seo_plugin();
	if ($which === 'rankmath') {
		update_post_meta($post_id, 'rank_math_canonical_url', $url);
	} elseif ($which === 'yoast') {
		update_post_meta($post_id, '_yoast_wpseo_canonical', $url);
	} elseif ($which === 'aioseo') {
		return false; // stored in AIOSEO's own table; not safely settable here
	} else {
		update_post_meta($post_id, '_opsdash_canonical', $url);
		return true;
	}
	// A plugin owns the canonical now, so make sure ours is not also emitted.
	delete_post_meta($post_id, '_opsdash_canonical');
	return true;
}

function opsdash_set_seo_meta($post_id, $seo_title, $meta_desc, $focus_kw = '') {
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
	// Focus keyword: without it Rank Math/Yoast show the post as having no SEO
	// data at all (no keyword, no score), even when title/description are set.
	if ($focus_kw !== '') {
		if ($which === 'yoast')      update_post_meta($post_id, '_yoast_wpseo_focuskw', $focus_kw);
		elseif ($which === 'rankmath') update_post_meta($post_id, 'rank_math_focus_keyword', $focus_kw);
		elseif ($which === 'aioseo')   update_post_meta($post_id, '_aioseo_keyphrases', opsdash_json(['focus' => ['keyphrase' => $focus_kw], 'additional' => []]));
		update_post_meta($post_id, '_opsdash_focus_keyword', $focus_kw);
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
		// Social share (Open Graph / Twitter) tags — an SEO plugin normally
		// provides these; without one, shared links would have no preview.
		$t = get_post_meta($pid, '_opsdash_seo_title', true);
		if (!$t) $t = get_the_title($pid);
		echo '<meta property="og:type" content="article" />' . "\n";
		echo '<meta property="og:title" content="' . esc_attr($t) . '" />' . "\n";
		if ($d) echo '<meta property="og:description" content="' . esc_attr($d) . '" />' . "\n";
		echo '<meta property="og:url" content="' . esc_url(get_permalink($pid)) . '" />' . "\n";
		$thumb = get_the_post_thumbnail_url($pid, 'large');
		if ($thumb) echo '<meta property="og:image" content="' . esc_url($thumb) . '" />' . "\n";
		echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";
	}
	$schema = get_post_meta($pid, '_opsdash_schema', true);
	if ($schema) {
		$decoded = json_decode($schema, true);
		if ($decoded) echo '<script type="application/ld+json">' . opsdash_json($decoded) . '</script>' . "\n";
	}
	// Canonical fix: only for pages the audit flagged as missing one, and only
	// when no SEO plugin is emitting its own. Printing ours alongside Rank
	// Math's produces two conflicting canonicals, which Google ignores
	// outright - strictly worse than the single tag it already had.
	if (opsdash_seo_plugin() === 'none') {
		$canon = get_post_meta($pid, '_opsdash_canonical', true);
		if ($canon) echo '<link rel="canonical" href="' . esc_url($canon) . '" />' . "
";
	}
});

// ---------------------------------------------------------------------------
// Microsoft Clarity — behaviour analytics (heatmaps, session recordings,
// rage/dead clicks). Ops Dash sets the project id remotely via /clarity; the
// official snippet is then emitted on EVERY page. This is its own wp_head hook,
// NOT part of the singular-only SEO hook above: tracking belongs on the home
// page, archives and search results too. 1.9.3.
// ---------------------------------------------------------------------------
function opsdash_clarity_id() {
	// Clarity project ids are short lowercase alphanumerics; sanitising on READ
	// means even a bad value written directly to wp_options cannot break out of
	// the string literal below.
	$id = (string) get_option('opsdash_clarity_id', '');
	return preg_replace('/[^a-z0-9]/', '', strtolower($id));
}
add_action('wp_head', function () {
	$id = opsdash_clarity_id();
	if ($id === '' || strlen($id) > 20) return;
	echo "<script type=\"text/javascript\">\n" .
		"(function(c,l,a,r,i,t,y){\n" .
		"    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};\n" .
		"    t=l.createElement(r);t.async=1;t.src=\"https://www.clarity.ms/tag/\"+i;\n" .
		"    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);\n" .
		"})(window, document, \"clarity\", \"script\", \"" . esc_js($id) . "\");\n" .
		"</script>\n";
}, 5);

// ---------------------------------------------------------------------------
// robots.txt — WordPress serves a VIRTUAL robots.txt through this filter, but
// only when no physical robots.txt sits at the web root. When Ops Dash has
// stored custom rules we serve those verbatim; empty option = WP default.
// ---------------------------------------------------------------------------
add_filter('robots_txt', function ($output, $public) {
	$custom = (string) get_option('opsdash_robots', '');
	return $custom !== '' ? $custom . "\n" : $output;
}, 20, 2);

// A physical file at the web root wins over the filter. Since 1.7.1 we manage
// it directly: back the original up once, then write the Ops Dash rules INTO
// the physical file. Resetting to the WordPress default restores the backup.
function opsdash_physical_robots() {
	$path = trailingslashit(ABSPATH) . 'robots.txt';
	return @file_exists($path) ? $path : '';
}
function opsdash_robots_backup_path() {
	return trailingslashit(ABSPATH) . 'robots-opsdash-backup.txt';
}
// Returns ['written' => bool, 'warning' => string]
function opsdash_write_physical_robots($content) {
	$phys = opsdash_physical_robots();
	if ($phys === '') return ['written' => false, 'warning' => ''];
	if (!@is_writable($phys)) {
		return ['written' => false, 'warning' => 'A physical robots.txt exists at the web root and is NOT writable by WordPress, so it still overrides these rules. Fix its file permissions or delete it on the server.'];
	}
	$bak = opsdash_robots_backup_path();
	if (!@file_exists($bak)) @copy($phys, $bak);
	$okw = @file_put_contents($phys, rtrim((string) $content) . "\n");
	if ($okw === false) {
		return ['written' => false, 'warning' => 'Could not write to the physical robots.txt at the web root — it still overrides these rules. Fix its file permissions or delete it on the server.'];
	}
	return ['written' => true, 'warning' => ''];
}
function opsdash_restore_physical_robots() {
	$phys = opsdash_physical_robots();
	$bak = opsdash_robots_backup_path();
	if ($phys === '' || !@file_exists($bak)) return false;
	$ok = @copy($bak, $phys);
	if ($ok) @unlink($bak);
	return (bool) $ok;
}

// Let Ops Dash force WordPress core sitemaps back on if something disabled them.
add_filter('wp_sitemaps_enabled', function ($enabled) {
	return get_option('opsdash_force_core_sitemap') ? true : $enabled;
}, 99);

function opsdash_sitemap_info() {
	$seo = opsdash_seo_plugin();
	$core_enabled = function_exists('wp_sitemaps_get_server') ? (bool) apply_filters('wp_sitemaps_enabled', true) : false;
	$likely = '';
	if ($seo === 'yoast' || $seo === 'rankmath') $likely = home_url('/sitemap_index.xml');
	elseif ($seo === 'aioseo') $likely = home_url('/sitemap.xml');
	elseif ($core_enabled) $likely = home_url('/wp-sitemap.xml');
	return [
		'seo_plugin' => $seo,
		'core_sitemaps_enabled' => $core_enabled,
		'core_sitemap_url' => $core_enabled ? home_url('/wp-sitemap.xml') : '',
		'likely_sitemap_url' => $likely,
		'forced_by_opsdash' => (bool) get_option('opsdash_force_core_sitemap'),
	];
}

// ---------------------------------------------------------------------------
// REST API: /wp-json/opsdash/v1/*
// ---------------------------------------------------------------------------
add_action('rest_api_init', function () {

	// GET  — read the robots.txt situation: our stored rules, whether a physical
	//        file is overriding us, and the sitemap that should be referenced.
	// POST — replace the virtual robots.txt ({content}); empty string hands
	//        control back to the WordPress default.
	register_rest_route('opsdash/v1', '/robots', [
		'methods' => ['GET', 'POST'],
		'permission_callback' => 'opsdash_auth',
		'callback' => function (WP_REST_Request $req) {
			$saved = false;
			$warning = '';
			$physical_written = false;
			if ($req->get_method() === 'POST') {
				$p = $req->get_json_params();
				if (!is_array($p)) $p = [];
				$content = (string) ($p['content'] ?? '');
				if (strlen($content) > 10000) return new WP_Error('opsdash_bad_request', 'robots.txt too large', ['status' => 400]);
				// Plain text only — strip any markup, keep line breaks.
				$clean = sanitize_textarea_field($content);
				update_option('opsdash_robots', $clean);
				$saved = true;
				if ($clean === '') {
					// Handing control back to WordPress: restore the original
					// physical file if we replaced it earlier.
					opsdash_restore_physical_robots();
				} else {
					// A physical file overrides the WP filter — write the rules
					// straight into it (original backed up once).
					$w = opsdash_write_physical_robots($clean);
					$physical_written = $w['written'];
					$warning = $w['warning'];
				}
			}
			$phys = opsdash_physical_robots();
			if (!$saved && $phys !== '' && (string) get_option('opsdash_robots', '') !== '' && @file_get_contents($phys) !== false && trim((string) @file_get_contents($phys)) !== trim((string) get_option('opsdash_robots', ''))) {
				$warning = 'A physical robots.txt at the web root differs from the managed rules. Re-apply the fix to overwrite it (the original is backed up first).';
			}
			return [
				'ok' => true,
				'saved' => $saved,
				'managed' => (string) get_option('opsdash_robots', ''),
				'physical_file' => $phys !== '',
				'physical_written' => $physical_written,
				'physical_backup' => @file_exists(opsdash_robots_backup_path()),
				'physical_contents' => $phys !== '' ? substr((string) @file_get_contents($phys), 0, 10000) : '',
				'warning' => $warning,
				'robots_url' => home_url('/robots.txt'),
				'site_public' => (string) get_option('blog_public') === '1',
				'sitemap' => opsdash_sitemap_info(),
			];
		},
	]);

	// llms.txt — the emerging AI-assistant site summary (llmstxt.org). Served
	// as a PHYSICAL file at the web root so any host serves it without rewrite
	// rules. GET reads the state; POST {content} writes it (a pre-existing
	// file is backed up once); POST {content: ""} removes our file.
	register_rest_route('opsdash/v1', '/llms', [
		'methods' => ['GET', 'POST'],
		'permission_callback' => 'opsdash_auth',
		'callback' => function (WP_REST_Request $req) {
			$path = trailingslashit(ABSPATH) . 'llms.txt';
			$bak = trailingslashit(ABSPATH) . 'llms-opsdash-backup.txt';
			$saved = false;
			$warning = '';
			if ($req->get_method() === 'POST') {
				$p = $req->get_json_params();
				if (!is_array($p)) $p = [];
				$content = (string) ($p['content'] ?? '');
				if (strlen($content) > 30000) return new WP_Error('opsdash_bad_request', 'llms.txt too large', ['status' => 400]);
				$clean = sanitize_textarea_field($content);
				if ($clean === '') {
					if (@file_exists($bak)) { @copy($bak, $path); @unlink($bak); }
					elseif (@file_exists($path)) @unlink($path);
					$saved = true;
				} else {
					if (@file_exists($path) && !@file_exists($bak)) @copy($path, $bak);
					$okw = @file_put_contents($path, rtrim($clean) . "\n");
					if ($okw === false) $warning = 'Could not write llms.txt at the web root — fix file permissions on the server.';
					else $saved = true;
				}
			}
			$exists = @file_exists($path);
			return [
				'ok' => true,
				'saved' => $saved,
				'exists' => $exists,
				'contents' => $exists ? substr((string) @file_get_contents($path), 0, 30000) : '',
				'writable' => $exists ? (bool) @is_writable($path) : (bool) @is_writable(ABSPATH),
				'backup' => @file_exists($bak),
				'warning' => $warning,
				'llms_url' => home_url('/llms.txt'),
			];
		},
	]);

	// Sitemap status, and optionally switch WordPress core sitemaps back on.
	register_rest_route('opsdash/v1', '/sitemap', [
		'methods' => ['GET', 'POST'],
		'permission_callback' => 'opsdash_auth',
		'callback' => function (WP_REST_Request $req) {
			if ($req->get_method() === 'POST') {
				// get_json_params() is null when the body is not JSON — array_key_exists()
				// would throw a TypeError on null under PHP 8.
				$p = $req->get_json_params();
				if (!is_array($p)) $p = [];
				if (array_key_exists('enable_core', $p)) update_option('opsdash_force_core_sitemap', !empty($p['enable_core']) ? 1 : 0);
			}
			return ['ok' => true, 'sitemap' => opsdash_sitemap_info()];
		},
	]);

	// Microsoft Clarity project id: GET reports it, POST sets or clears it
	// ({"project_id": ""} clears). The tracking snippet goes live on the next
	// page load — no cache purge is attempted here, so a page-cached site may
	// take until its cache expires to start recording.
	register_rest_route('opsdash/v1', '/clarity', [
		'methods' => ['GET', 'POST'],
		'permission_callback' => 'opsdash_auth',
		'callback' => function (WP_REST_Request $req) {
			if ($req->get_method() === 'POST') {
				$p = $req->get_json_params();
				if (!is_array($p)) $p = [];
				if (array_key_exists('project_id', $p)) {
					$id = preg_replace('/[^a-z0-9]/', '', strtolower((string) $p['project_id']));
					if (strlen($id) > 20) return new WP_Error('opsdash_bad_id', 'That does not look like a Clarity project id.', ['status' => 400]);
					update_option('opsdash_clarity_id', $id);
				}
			}
			return ['ok' => true, 'clarity_id' => opsdash_clarity_id()];
		},
	]);

	// Normalise heading structure so the page has exactly one H1. Driven by the
	// RENDERED h1 count from the audit, because many themes emit their own H1.
	register_rest_route('opsdash/v1', '/fix-headings', [
		'methods' => 'POST',
		'permission_callback' => 'opsdash_auth',
		'callback' => 'opsdash_fix_headings',
	]);


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
				'clarity_id' => opsdash_clarity_id(),
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

	// Post categories: list the site's existing ones, or create a new one so
	// Ops Dash can organize blog posts without a wp-admin round trip.
	register_rest_route('opsdash/v1', '/categories', [
		'methods' => 'GET',
		'permission_callback' => 'opsdash_auth',
		'callback' => function () {
			$cats = get_categories(['hide_empty' => false, 'number' => 200]);
			return array_map(function ($c) {
				return ['id' => (int) $c->term_id, 'name' => $c->name, 'slug' => $c->slug, 'count' => (int) $c->count];
			}, $cats);
		},
	]);
	register_rest_route('opsdash/v1', '/categories', [
		'methods' => 'POST',
		'permission_callback' => 'opsdash_auth',
		'callback' => function (WP_REST_Request $req) {
			$p = $req->get_json_params();
			$name = sanitize_text_field($p['name'] ?? '');
			if ($name === '') return new WP_Error('opsdash_bad_request', 'name is required', ['status' => 400]);
			$id = opsdash_category_id($name);
			if (!$id) return new WP_Error('opsdash_cat_failed', 'could not create category', ['status' => 500]);
			$t = get_term($id, 'category');
			return ['ok' => true, 'id' => (int) $id, 'name' => $t ? $t->name : $name, 'slug' => $t ? $t->slug : sanitize_title($name)];
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

	// WordPress-authoritative page signals (read-only) — the audit's fallback
	// when CDN bot protection blocks its crawler. ?url=<public page url>
	register_rest_route('opsdash/v1', '/page-signals', [
		'methods' => 'GET',
		'permission_callback' => 'opsdash_auth',
		'callback' => 'opsdash_page_signals',
	]);
});

// Find a category by name (case-insensitive, then slug), creating it if needed.
function opsdash_category_id($name) {
	$name = trim((string) $name);
	if ($name === '') return 0;
	$t = get_term_by('name', $name, 'category');
	if (!$t) $t = get_term_by('slug', sanitize_title($name), 'category');
	if ($t) return (int) $t->term_id;
	$new = wp_insert_term($name, 'category');
	if (is_wp_error($new)) {
		// Race or slug collision: one more lookup before giving up.
		$t = get_term_by('slug', sanitize_title($name), 'category');
		return $t ? (int) $t->term_id : 0;
	}
	return (int) $new['term_id'];
}

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

// Normalise a page to exactly one H1.
// `rendered_h1` is what the audit actually saw in the live HTML, which matters
// because most themes output the post title as an H1 outside post_content:
//   rendered 0  -> content has no H1 and the theme adds none: insert one.
//   rendered >1 -> if the extras all live in content, keep the first and demote
//                  the rest; if the theme supplies one too, demote every H1 in
//                  content so the theme's remains the only one.
function opsdash_fix_headings(WP_REST_Request $req) {
	$p = $req->get_json_params();
	if (!is_array($p)) $p = [];
	$post_id = opsdash_resolve_post($p);
	if (!$post_id) return new WP_Error('opsdash_not_found', 'post not found for that id/url', ['status' => 404]);
	if (get_post_meta($post_id, '_elementor_data', true)) return ['ok' => true, 'skipped' => 'elementor', 'note' => 'Page is built with Elementor — headings live in the builder and must be changed there.'];

	$content = (string) get_post_field('post_content', $post_id);
	$content_h1 = preg_match_all('/<h1\b[^>]*>/i', $content);
	$rendered_h1 = array_key_exists('rendered_h1', $p) ? (int) $p['rendered_h1'] : $content_h1;
	$new = $content;
	$action = 'none';

	if ($rendered_h1 === 0) {
		$title = get_the_title($post_id);
		if ($title !== '') { $new = '<h1>' . esc_html($title) . '</h1>' . "\n\n" . $content; $action = 'added_h1'; }
	} elseif ($rendered_h1 > 1 && $content_h1 > 0) {
		// Theme contributes an H1 when the live page has more of them than the
		// content does — in that case every content H1 is surplus.
		$demote_all = ($content_h1 < $rendered_h1);
		$seen = 0;
		$new = preg_replace_callback('/<(\/?)h1(\b[^>]*)>/i', function ($m) use (&$seen, $demote_all) {
			if ($m[1] === '') {
				$seen++;
				return ($demote_all || $seen > 1) ? '<h2' . $m[2] . '>' : $m[0];
			}
			return ($demote_all || $seen > 1) ? '</h2>' : $m[0];
		}, $content);
		$action = $demote_all ? 'demoted_all_content_h1' : 'demoted_extra_h1';
	}

	$changed = ($new !== $content);
	if ($changed) wp_update_post(['ID' => $post_id, 'post_content' => $new]);
	return ['ok' => true, 'post_id' => $post_id, 'changed' => $changed, 'action' => $action, 'content_h1' => $content_h1, 'rendered_h1' => $rendered_h1];
}

// WordPress-authoritative page signals for the Ops Dash audit. When a CDN bot
// challenge (Cloudflare "Just a moment…") blocks the dashboard's crawler, the
// audit asks this endpoint what the site itself knows — index state, SEO
// title/description, content stats — instead of scoring the challenge page
// (whose own noindex meta would false-flag every page of a protected site).
function opsdash_page_signals(WP_REST_Request $req) {
	$url = esc_url_raw((string) $req->get_param('url'));
	if ($url === '') return new WP_Error('opsdash_bad_request', 'url is required', ['status' => 400]);
	$id = url_to_postid($url);
	if (!$id) {
		// url_to_postid() can't resolve the front page — match it by hand.
		$strip = function ($u) { return strtolower(untrailingslashit(preg_replace('#^https?://(www\.)?#i', '', (string) $u))); };
		if ($strip($url) === $strip(home_url()) && get_option('show_on_front') === 'page') $id = (int) get_option('page_on_front');
	}
	$post = $id ? get_post($id) : null;
	if (!$post || !in_array($post->post_type, opsdash_allowed_types(), true)) return ['ok' => true, 'resolved' => false];

	$seo = opsdash_seo_plugin();

	// Index state: the site-wide "discourage search engines" switch plus the SEO
	// plugin's own per-post robots setting — the same data that renders the meta
	// tag Google reads, without fetching any HTML.
	$noindex = ((string) get_option('blog_public') !== '1');
	$title = ''; $desc = '';
	if ($seo === 'yoast') {
		if ((string) get_post_meta($id, '_yoast_wpseo_meta-robots-noindex', true) === '1') $noindex = true;
		$title = (string) get_post_meta($id, '_yoast_wpseo_title', true);
		$desc  = (string) get_post_meta($id, '_yoast_wpseo_metadesc', true);
	} elseif ($seo === 'rankmath') {
		$robots = get_post_meta($id, 'rank_math_robots', true);
		if (is_array($robots) && in_array('noindex', $robots, true)) $noindex = true;
		$title = (string) get_post_meta($id, 'rank_math_title', true);
		$desc  = (string) get_post_meta($id, 'rank_math_description', true);
	} elseif ($seo === 'aioseo') {
		// AIOSEO v4 keeps per-post settings in its own table, not post meta.
		global $wpdb;
		$table = $wpdb->prefix . 'aioseo_posts';
		if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) === $table) {
			$row = $wpdb->get_row($wpdb->prepare("SELECT title, description, robots_default, robots_noindex FROM {$table} WHERE post_id = %d", $id));
			if ($row) {
				if (!(int) $row->robots_default && (int) $row->robots_noindex) $noindex = true;
				$title = (string) $row->title;
				$desc  = (string) $row->description;
			}
		}
	}
	if ($title === '') $title = (string) get_post_meta($id, '_opsdash_seo_title', true);
	if ($desc === '')  $desc  = (string) get_post_meta($id, '_opsdash_meta_desc', true);
	// Unrendered template variables (%%title%%, %post_title%) would fool the
	// audit's length checks — fall back to the plain post title instead.
	if ($title === '' || strpos($title, '%%') !== false || preg_match('/%[a-z_]+%/i', $title)) $title = get_the_title($id);

	// Content stats from post_content. Builder pages (Elementor, Beaver,
	// WPBakery) keep their real content elsewhere, so their stats would read as
	// false "thin content" — report those as unreliable instead.
	$raw = (string) $post->post_content;
	$builder = (bool) get_post_meta($id, '_elementor_data', true)
		|| (bool) get_post_meta($id, '_fl_builder_data', true)
		|| strpos($raw, '[vc_row') !== false;
	$plain = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags(strip_shortcodes($raw))));
	$words = $plain === '' ? 0 : count(preg_split('/\s+/u', $plain));
	$content = ['reliable' => false];
	if (!$builder && $words >= 50) {
		preg_match_all('/<img\b[^>]*>/i', $raw, $imgs);
		$no_alt = 0;
		foreach ($imgs[0] as $tag) { if (!preg_match('/\balt=["\'][^"\']*\S[^"\']*["\']/i', $tag)) $no_alt++; }
		preg_match_all('/<a\b[^>]*href=["\']([^"\']+)["\']/i', $raw, $links);
		$internal = 0; $external = 0;
		$home_host = strtolower((string) wp_parse_url(home_url(), PHP_URL_HOST));
		foreach ($links[1] as $href) {
			if (preg_match('/^(#|mailto:|tel:|javascript:)/i', $href)) continue;
			$host = strtolower((string) wp_parse_url($href, PHP_URL_HOST));
			if ($host === '' || $host === $home_host || 'www.' . $host === $home_host || $host === 'www.' . $home_host) $internal++;
			else $external++;
		}
		$content = [
			'reliable' => true,
			'word_count' => $words,
			'h2' => (int) preg_match_all('/<h2[\s>]/i', $raw),
			'h3' => (int) preg_match_all('/<h3[\s>]/i', $raw),
			'imgs' => count($imgs[0]),
			'imgs_no_alt' => $no_alt,
			'internal_links' => $internal,
			'external_links' => $external,
		];
	}

	return [
		'ok' => true,
		'resolved' => true,
		'post_id' => $id,
		'post_type' => $post->post_type,
		'post_status' => $post->post_status,
		'seo_plugin' => $seo,
		'site_public' => (string) get_option('blog_public') === '1',
		'noindex' => $noindex,
		'title' => $title,
		'meta_desc' => $desc,
		// An active SEO plugin emits a self-referencing canonical on its own; so
		// does the connector when Ops Dash has stored one.
		'canonical_auto' => ($seo !== 'none' || (bool) get_post_meta($id, '_opsdash_canonical', true)),
		// Yoast/Rank Math/AIOSEO all output a JSON-LD graph on every page; the
		// connector's own schema meta counts too. null = genuinely unknown.
		'has_schema' => ($seo !== 'none' || get_post_meta($id, '_opsdash_schema', true)) ? true : null,
		'content' => $content,
		// Plain text for the AI (AEO) analysis when the crawler can't read the page.
		'text' => function_exists('mb_substr') ? mb_substr($plain, 0, 12000) : substr($plain, 0, 12000),
	];
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
	// Categories by NAME (find-or-create) — posts only; pages have no categories.
	if ($type === 'post' && !empty($p['category_names']) && is_array($p['category_names'])) {
		$cat_ids = [];
		foreach (array_slice($p['category_names'], 0, 5) as $cn) {
			$cid = opsdash_category_id(sanitize_text_field((string) $cn));
			if ($cid) $cat_ids[] = $cid;
		}
		if ($cat_ids) $args['post_category'] = $cat_ids;
	}
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

	opsdash_set_seo_meta($post_id, sanitize_text_field($p['seo_title'] ?? ''), sanitize_text_field($p['meta_description'] ?? ''), sanitize_text_field($p['focus_keyword'] ?? ''));
	if (!empty($p['schema_jsonld'])) opsdash_set_schema($post_id, $p['schema_jsonld']);
	// Self-referencing canonical: SEO plugins emit one automatically; on sites
	// without one, our own head output covers it.
	if (opsdash_seo_plugin() === 'none') update_post_meta($post_id, '_opsdash_canonical', get_permalink($post_id));

	$article_title = sanitize_text_field($p['title'] ?? '');

	$featured = null;
	if (!empty($p['featured_image_url'])) {
		$img = opsdash_sideload_featured($post_id, $p['featured_image_url'], $p['featured_image_alt'] ?? '', $article_title);
		$featured = is_wp_error($img) ? ['error' => $img->get_error_message()] : ['attachment_id' => $img];
	}

	// Inline article images: each {marker, alt, url | data_base64+mime}. The marker
	// token is replaced in the post content with proper figure markup; the first
	// image becomes the featured image when none was set explicitly.
	$img_results = [];
	if (!empty($p['images']) && is_array($p['images'])) {
		$content2 = get_post_field('post_content', $post_id);
		$first_att = 0;
		$img_n = 0;
		foreach (array_slice($p['images'], 0, 8) as $img) {
			if (!is_array($img)) continue;
			$att = opsdash_attach_image($post_id, $img, $img_n++, $article_title);
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

// SEO filename for an attachment: slugified alt text (what the image IS), an
// index to keep siblings unique, and the real extension. "dryer-vent-cleaning
// -ocala-fl-2.png" instead of "0.png" or a stock-photo hash. 1.9.4.
function opsdash_img_filename($alt, $index, $ext) {
	$base = sanitize_title(wp_trim_words(sanitize_text_field((string) $alt), 8, ''));
	if ($base === '') $base = 'image';
	$base = substr($base, 0, 70);
	return $base . ($index > 0 ? '-' . ($index + 1) : '') . '.' . $ext;
}

// Media-library SEO fields on an attachment: title (what shows in the
// library and some themes' lightboxes), alt (already the ranking signal),
// caption + description (the library's excerpt/content). All derived from
// the slot's SEO alt text plus the article it belongs to — the data the
// publish payload already carries.
function opsdash_img_meta($att, $alt, $post_title) {
	$alt = sanitize_text_field((string) $alt);
	if ($alt === '') return;
	update_post_meta($att, '_wp_attachment_image_alt', $alt);
	$desc = $post_title !== ''
		? sprintf('%s — image from the article “%s”.', $alt, sanitize_text_field($post_title))
		: $alt;
	wp_update_post([
		'ID' => $att,
		'post_title' => $alt,
		'post_excerpt' => $alt,       // caption
		'post_content' => $desc,      // description
	]);
}

// Attach one image (remote URL or base64 payload) to the media library.
// 1.9.4: the stored FILE NAME is controlled (download_url + media_handle_
// sideload instead of media_sideload_image, whose filename comes from the
// remote URL — which for our pipeline was junk like "0.png" or a stock hash),
// and title/alt/caption/description are all populated from the slot's SEO alt
// text. $index keeps sibling filenames unique; $post_title feeds the
// description.
function opsdash_attach_image($post_id, $img, $index = 0, $post_title = '') {
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$alt = sanitize_text_field($img['alt'] ?? '');
	$att = null;
	if (!empty($img['url'])) {
		$url = esc_url_raw($img['url']);
		$tmp = download_url($url, 60);
		if (is_wp_error($tmp)) return $tmp;
		$path = (string) wp_parse_url($url, PHP_URL_PATH);
		$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
		if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif'], true)) $ext = 'jpg';
		$file_array = [
			'name' => opsdash_img_filename($alt !== '' ? $alt : basename($path), $index, $ext),
			'tmp_name' => $tmp,
		];
		$att = media_handle_sideload($file_array, $post_id);
		if (is_wp_error($att)) { @unlink($tmp); return $att; }
	} elseif (!empty($img['data_base64'])) {
		$bits = base64_decode($img['data_base64'], true);
		if ($bits === false) return new WP_Error('opsdash_b64', 'invalid base64 image data');
		$mime = in_array($img['mime'] ?? '', ['image/png', 'image/jpeg', 'image/webp'], true) ? $img['mime'] : 'image/jpeg';
		$ext = $mime === 'image/png' ? 'png' : ($mime === 'image/webp' ? 'webp' : 'jpg');
		$up = wp_upload_bits(opsdash_img_filename($alt, $index, $ext), null, $bits);
		if (!empty($up['error'])) return new WP_Error('opsdash_upload', $up['error']);
		$att = wp_insert_attachment([
			'post_mime_type' => $mime,
			'post_title' => $alt !== '' ? $alt : 'Image',
			'post_status' => 'inherit',
		], $up['file'], $post_id);
		if (is_wp_error($att)) return $att;
		wp_update_attachment_metadata($att, wp_generate_attachment_metadata($att, $up['file']));
	} else {
		return new WP_Error('opsdash_noimg', 'image needs url or data_base64');
	}
	opsdash_img_meta($att, $alt, $post_title);
	return $att;
}

// Download an image from a URL into the media library and set it as the
// post's featured image. Failures here never fail the publish itself.
// 1.9.4: same SEO filename + metadata treatment as inline images.
function opsdash_sideload_featured($post_id, $url, $alt, $post_title = '') {
	$att_id = opsdash_attach_image($post_id, ['url' => $url, 'alt' => $alt], 0, $post_title);
	if (is_wp_error($att_id)) return $att_id;
	set_post_thumbnail($post_id, $att_id);
	return $att_id;
}

function opsdash_update_seo(WP_REST_Request $req) {
	$p = $req->get_json_params();
	$post_id = opsdash_resolve_post($p);
	if (!$post_id) return new WP_Error('opsdash_not_found', 'no post or page found for that id/url', ['status' => 404]);

	opsdash_set_seo_meta($post_id, sanitize_text_field($p['seo_title'] ?? ''), sanitize_text_field($p['meta_description'] ?? ''), sanitize_text_field($p['focus_keyword'] ?? ''));
	if (!empty($p['schema_jsonld'])) opsdash_set_schema($post_id, $p['schema_jsonld']);
	$canonical_set = null;
	if (!empty($p['canonical'])) $canonical_set = opsdash_set_canonical($post_id, $p['canonical']);

	$out = ['ok' => true, 'post_id' => $post_id, 'link' => get_permalink($post_id)];
	if ($canonical_set !== null) {
		$out['canonical_set'] = $canonical_set;
		$out['seo_plugin'] = opsdash_seo_plugin();
		if (!$canonical_set) $out['canonical_note'] = 'This site keeps canonicals inside its SEO plugin, which the connector cannot write. Set it there instead.';
	}
	return $out;
}
