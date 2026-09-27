import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (existsSync('.credentials/release.keystore')) throw new Error('Refusing to replace an existing signing identity');
const password = randomBytes(32).toString('hex');
const env = { ...process.env, FOLDER_PLAYER_KEY_PASSWORD: password };
execFileSync(`${process.env.JAVA_HOME}/bin/keytool`, ['-genkeypair', '-v', '-keystore', '.credentials/release.keystore', '-alias', 'folder-player', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-storepass:env', 'FOLDER_PLAYER_KEY_PASSWORD', '-keypass:env', 'FOLDER_PLAYER_KEY_PASSWORD', '-dname', 'CN=Folder Player, OU=Personal, O=EVB, C=AM'], { env, stdio: 'ignore' });
writeFileSync('.credentials/signing.properties', `storePassword=${password}\nkeyPassword=${password}\nkeyAlias=folder-player\n`, { mode: 0o600 });
