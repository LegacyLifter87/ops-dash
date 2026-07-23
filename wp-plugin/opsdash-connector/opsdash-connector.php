<?php
/**
 * Plugin Name: Ops Dash Connector
 * Description: Connects this site to the Ops Dash SEO platform. Receives AI-drafted blog posts and SEO metadata (titles, meta descriptions, JSON-LD schema) pushed from your Ops Dash dashboard. Content arrives as drafts unless your dashboard says otherwise. Works with Yoast, Rank Math, and All in One SEO — or standalone.
 * Version: 1.7.3
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

define('OPSDASH_VERSION', '1.7.3');
// Pairing-code exchange endpoint: the plugin trades the short code the user
// typed for the real connection key, server-to-server. Public endpoint; codes
// are single-use, 15-minute, host-locked, and rate-limited server-side.
define('OPSDASH_PAIR_URL', 'https://ghwmaluhbrainprieoaq.supabase.co/functions/v1/seo-wp-pair');
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
