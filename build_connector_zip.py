import os, zipfile

SRC = 'wp-plugin/opsdash-connector'
VER = '1.9.2'
OUT = f'opsdash-connector-{VER}.zip'

if os.path.exists(OUT):
    os.remove(OUT)

# POSIX archive: forward slashes only. Windows Compress-Archive writes backslash
# entry names, which Linux WordPress extracts as ONE file with a literal "\" in
# its name instead of a plugin folder. That is exactly what bricked the 1.5.0
# and 1.6.0 releases, and the plugin still carries cleanup code for the debris.
count = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in ('.git', '__pycache__', 'node_modules')]
        for f in sorted(files):
            full = os.path.join(root, f)
            rel = os.path.relpath(full, 'wp-plugin').replace(os.sep, '/')
            z.write(full, rel)
            count += 1

with zipfile.ZipFile(OUT) as z:
    names = z.namelist()

bad = [n for n in names if chr(92) in n]
rooted = all(n.startswith('opsdash-connector/') for n in names)
print('files:', count, 'bytes:', os.path.getsize(OUT))
print('backslash entry names:', len(bad), '(must be 0)')
print('all under opsdash-connector/:', rooted, '(must be True)')
print('sample:', names[:4])
