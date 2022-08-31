#! /usr/bin/env node
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import cp from 'child_process';

import tar from 'tar';
import AdmZip from 'adm-zip';

const chars = [
    '⡀',
    '⡄',
    '⡆',
    '⡇',
    '⡏',
    '⡟',
    '⡿',
    '⣿'
];

const updatesPerSecond = 333;

function parseArgs(args: string[]) {
    const obj: {
        double: {
            [key: string]: string | boolean;
        };
        single: {
            [key: string]: string | boolean;
        };
    } = {
        double: {},
        single: {},
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);

            if (key.includes('=')) {
                const [k, ...v] = key.split('=');
                obj.double[k] = v.join('=');
            } else if (args[i + 1] && !args[i + 1].startsWith('-')) {
                obj.double[key] = args[i + 1];
                i++;
            } else {
                obj.double[key] = true;
            }
        } else if (arg.startsWith('-')) {
            const key = arg.slice(1);

            if (key.includes('=')) {
                const [k, ...v] = key.split('=');
                obj.single[k] = v.join('=');
            } else if (args[i + 1] && !args[i + 1].startsWith('-')) {
                obj.single[key] = args[i + 1];
                i++;
            } else {
                obj.single[key] = true;
            }
        }
    }

    return obj;
}

function handleRes(response: http.IncomingMessage, filename: string, file: fs.WriteStream) {
    const maxLength = parseInt(response.headers['content-length'] || '0', 10);

    console.log(`Downloading ${filename} (${maxLength} bytes)`);

    let maxDownloadStatusLen = Math.round(process.stdout.columns - `Downloading ${filename}... `.length) - (3 + (`${maxLength} `.length * 2) + ' 100%'.length);

    const resizeFn = () => {
        maxDownloadStatusLen = Math.round(process.stdout.columns - `Downloading ${filename}... `.length) - (3 + (`${maxLength} `.length * 2) + ' 100%'.length);
        process.stdout.cursorTo(0);
        process.stdout.clearLine(1);
        process.stdout.write(`Downloading ${filename}... [`);
    };

    process.stdout.on('resize', resizeFn);

    response.pipe(file);

    process.stdout.write(`Downloading ${filename}... [`);

    let progress = 0;
    const dlen = `Downloading ${filename}... [`.length;
    const chunkSize = Math.floor(maxLength / maxDownloadStatusLen);
    const finalchar = chars[chars.length - 1];

    const progressInterval = setInterval(() => {
        if (maxDownloadStatusLen < 10) {
            process.stdout.cursorTo(0);
            process.stdout.clearLine(1);

            process.stdout.write(`Downloading ${filename}... ${Math.round(progress * 100)}% (${file.bytesWritten}/${maxLength})`);
        } else {
            process.stdout.cursorTo(dlen);

            const char = chars[Math.floor(((file.bytesWritten % chunkSize) / chunkSize) * chars.length)];

            process.stdout.write(`${finalchar.repeat(Math.max(0, (progress * maxDownloadStatusLen) - 1))}${char}${'-'.repeat(maxDownloadStatusLen - progress * maxDownloadStatusLen)}] ${Math.round(progress * 100)}% (${file.bytesWritten}/${maxLength})`);
        }
    }, 1000 / updatesPerSecond);

    response.on('data', () => {
        progress = (file.bytesWritten / maxLength);
    });

    response.on('end', () => {
        clearInterval(progressInterval);
        process.stdout.removeListener('resize', resizeFn);
        process.stdout.cursorTo(0);
        process.stdout.clearLine(1);
        process.stdout.write(`Downloaded ${filename} (${maxLength} bytes)

`);
    });
}

function getVersions(build?: string): Promise<{
    url: string;
    name: string;
    version: string;
    productVersion: string;
    hash: string;
    timestamp: string;
    sha256hash: string;
    supportsFastUpdate: boolean;
    build: string;
    platform: {
        os: 'win32-user',
        prettyname: 'Windows User Installer (32 bit)'
    } | {
        os: 'win32',
        prettyname: 'Windows System Installer (32 bit)'
    } | {
        os: 'win32-archive',
        prettyname: 'Windows .zip (32 bit)'
    } | {
        os: 'win32-x64-user',
        prettyname: 'Windows User Installer (64 bit)'
    } | {
        os: 'win32-x64',
        prettyname: 'Windows System Installer (64 bit)'
    } | {
        os: 'win32-x64-archive',
        prettyname: 'Windows .zip (64 bit)'
    } | {
        os: 'win32-arm64-user',
        prettyname: 'Windows User Installer (64-bit ARM)'
    } | {
        os: 'win32-arm64-archive',
        prettyname: 'Windows .zip (64-bit ARM)'
    } | {
        os: 'win32-arm64',
        prettyname: 'Windows System Installer (64-bit ARM)'
    } | {
        os: 'linux-deb-ia32',
        prettyname: 'Linux .deb (32 bit)'
    } | {
        os: 'linux-rpm-ia32',
        prettyname: 'Linux .rpm (32 bit)'
    } | {
        os: 'linux-ia32',
        prettyname: 'Linux .tar.gz (32 bit)'
    } | {
        os: 'linux-deb-x64',
        prettyname: 'Linux .deb (64 bit)'
    } | {
        os: 'linux-rpm-x64',
        prettyname: 'Linux .rpm (64 bit)'
    } | {
        os: 'linux-x64',
        prettyname: 'Linux .tar.gz (64 bit)'
    } | {
        os: 'linux-armhf',
        prettyname: 'Linux .tar.gz (32-bit ARM)'
    } | {
        os: 'linux-deb-armhf',
        prettyname: 'Linux .deb (32-bit ARM)'
    } | {
        os: 'linux-rpm-armhf',
        prettyname: 'Linux .rpm (32-bit ARM)'
    } | {
        os: 'linux-arm64',
        prettyname: 'Linux .tar.gz (64-bit ARM)'
    } | {
        os: 'linux-deb-arm64',
        prettyname: 'Linux .deb (64-bit ARM)'
    } | {
        os: 'linux-rpm-arm64',
        prettyname: 'Linux .rpm (64-bit ARM)'
    } | {
        os: 'darwin-arm64',
        prettyname: 'Mac for Apple Silicon'
    } | {
        os: 'darwin',
        prettyname: 'Mac for Intel Chip'
    } | {
        os: 'darwin-universal',
        prettyname: 'Mac Universal Build'
    } | {
        os: 'win32-user',
        prettyname: 'Windows User Installer (32 bit)'
    } | {
        os: 'win32',
        prettyname: 'Windows System Installer (32 bit)'
    } | {
        os: 'win32-archive',
        prettyname: 'Windows .zip (32 bit)'
    } | {
        os: 'win32-x64-user',
        prettyname: 'Windows User Installer (64 bit)'
    } | {
        os: 'win32-x64',
        prettyname: 'Windows System Installer (64 bit)'
    } | {
        os: 'win32-x64-archive',
        prettyname: 'Windows .zip (64 bit)'
    } | {
        os: 'win32-arm64-user',
        prettyname: 'Windows User Installer (64-bit ARM)'
    } | {
        os: 'win32-arm64-archive',
        prettyname: 'Windows .zip (64-bit ARM)'
    } | {
        os: 'win32-arm64',
        prettyname: 'Windows System Installer (64-bit ARM)'
    } | {
        os: 'linux-deb-ia32',
        prettyname: 'Linux .deb (32 bit)'
    } | {
        os: 'linux-rpm-ia32',
        prettyname: 'Linux .rpm (32 bit)'
    } | {
        os: 'linux-ia32',
        prettyname: 'Linux .tar.gz (32 bit)'
    } | {
        os: 'linux-deb-x64',
        prettyname: 'Linux .deb (64 bit)'
    } | {
        os: 'linux-rpm-x64',
        prettyname: 'Linux .rpm (64 bit)'
    } | {
        os: 'linux-x64',
        prettyname: 'Linux .tar.gz (64 bit)'
    } | {
        os: 'linux-armhf',
        prettyname: 'Linux .tar.gz (32-bit ARM)'
    } | {
        os: 'linux-deb-armhf',
        prettyname: 'Linux .deb (32-bit ARM)'
    } | {
        os: 'linux-rpm-armhf',
        prettyname: 'Linux .rpm (32-bit ARM)'
    } | {
        os: 'linux-arm64',
        prettyname: 'Linux .tar.gz (64-bit ARM)'
    } | {
        os: 'linux-deb-arm64',
        prettyname: 'Linux .deb (64-bit ARM)'
    } | {
        os: 'linux-rpm-arm64',
        prettyname: 'Linux .rpm (64-bit ARM)'
    } | {
        os: 'darwin-arm64',
        prettyname: 'Mac for Apple Silicon'
    } | {
        os: 'darwin',
        prettyname: 'Mac for Intel Chip'
    } | {
        os: 'darwin-universal',
        prettyname: 'Mac Universal Build'
    }
}[]> {
    if (build && !['stable', 'insiders'].includes(build)) {
        return Promise.reject(new Error('Invalid build type'));
    }

    return new Promise((resolve, reject) => {
        const req = https.get(`https://code.visualstudio.com/sha${build ? `?build=${build}` : ''}`, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    resolve(JSON.parse(data).products);
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });
    });
}

const args = parseArgs(process.argv.slice(2));

const { double, single } = args;

const action =
    double['download']
        ? 'download' :
        double['install']
            ? 'install' :
            double['link']
                ? 'link' :
                double['help']
                    ? 'help' :
                    double['action'] || single['a'] || 'download';

if (typeof action !== 'string') {
    console.error('Invalid action');
    process.exit(1);
}

if (![
    'download',
    'install',
    'link',
    'update',
    'help',
    'versions'
].includes(action)) {
    console.error(`Invalid action: ${action}`);
    process.exit(1);
}

type Section = {
    keys: string[];
    description: string | (() => string);
    required?: boolean;
    default?: string;
}[];

const sections: {
    sections: Section;
    main: Section;
    download: Section;
    install: Section;
    link: Section;
    update: Section;
    versions: Section;
} = {
    sections: [
        {
            keys: ['--help', '-h'],
            description: 'Show this help message',
        },
        {
            keys: ['--section', '-s'],
            description: () => 'Show a specific section. Can be one of: ' + Object.keys(sections).join(', '),
        },
    ],
    main: [
        {
            keys: [
                '--action',
                '-a'
            ],
            description: 'The action to perform. Can be one of download, install, link, update, or help',
            required: false,
            default: 'download'
        }
    ],
    download: [
        {
            keys: [
                '--build',
                '-b'
            ],
            description: 'The build to download. Can either be stable or insiders',
            required: false,
            default: 'stable'
        },
        {
            keys: [
                '--filename',
                '-f'
            ],
            description: 'The filename to download to',
            required: false,
            default: 'vscode-{build}-{platform}-{arch}.{ext (tar.gz or zip)}'
        },
        {
            keys: [
                '--download-directory',
                '-d'
            ],
            description: 'The directory the file will be downloaded to',
            required: false,
            default: 'cwd/downloads'
        }
    ],
    install: [
        {
            keys: [
                '--file',
                '-f'
            ],
            description: 'The file to install from',
            required: true
        },
        {
            keys: [
                '--insiders',
                '-i'
            ],
            description: 'Install as insiders build (this option overrides --build or -b)',
            required: false
        },
        {
            keys: [
                '--stable',
                '-s'
            ],
            description: 'Install as stable build (this option overrides --build or -b)',
            required: false
        },
        {
            keys: [
                '--build',
                '-b'
            ],
            description: 'The build to install. Can either be stable or insiders',
            required: false,
            default: 'stable'
        },
        {
            keys: [
                '--install-directory',
                '-d'
            ],
            description: 'The directory to install to',
            required: false,
            default: process.platform === 'win32'
                ? '"C:\\Program Files\\Microsoft VS Code" or "C:\\Program Files\\Microsoft VS Code Insiders"'
                : process.platform === 'darwin'
                    ? '/Applications/Visual Studio Code or /Applications/Visual Studio Code - Insiders'
                    : '/usr/share/code or /usr/share/code-insiders'
        }
    ],
    link: [
        {
            keys: [
                '--build',
                '-b'
            ],
            description: 'The build to link. Can either be stable or insiders',
            required: false,
            default: 'stable'
        },
        {
            keys: [
                '--install-directory',
                '-d'
            ],
            description: 'The directory to link from',
            required: false,
            default: process.platform === 'darwin'
                ? '/Applications/Visual Studio Code or /Applications/Visual Studio Code - Insiders'
                : '/usr/share/code or /usr/share/code-insiders'
        },
        {
            keys: [
                '--symlink-directory',
                '-s'
            ],
            description: 'The directory to link to',
            required: false,
            default: process.platform === 'linux'
                ? '/usr/bin'
                : path.join(process.env.HOME, 'bin')
        }
    ],
    update: [
        {
            keys: [
                '--build',
                '-b'
            ],
            description: 'The build to update. Can either be stable or insiders',
            required: false,
            default: 'stable'
        },
        {
            keys: [
                '--install-directory',
                '-d'
            ],
            description: 'The directory to update',
            required: false,
            default: process.platform === 'win32'
                ? '"C:\\Program Files\\Microsoft VS Code" or "C:\\Program Files\\Microsoft VS Code Insiders"'
                : process.platform === 'darwin'
                    ? '/Applications/Visual Studio Code or /Applications/Visual Studio Code - Insiders'
                    : '/usr/share/code or /usr/share/code-insiders'
        }
    ],
    versions: [
        {
            keys: [
                '--build',
                '-b'
            ],
            description: 'The build to get versions for. Can either be stable, insiders, or all',
            required: false,
            default: 'all'
        }
    ]
};

function printSection(sectionName: keyof typeof sections) {
    const section = sections[sectionName];

    console.log(sectionName);

    for (const { keys, description, required, default: def } of section) {
        console.log(`  ${keys.join(', ')}:${required ? ' (required)' : ''}${def ? ` (default: ${def})` : ''}`);

        for (const line of (
            typeof description === 'string'
                ? description
                : description()
        ).split('\n')) {
            console.log(`    ${line}`);
        }
    }

    console.log();
}

async function helpAction(double: {
    [key: string]: string | boolean
}, single: {
    [key: string]: string | boolean
}) {
    const section = double['section'] || single['s'] || 'all';

    if (typeof section !== 'string') {
        console.error('Invalid section. If you want to see the sections, use --section=sections, -s=sections, or don\'t specify a section');
        process.exit(1);
    }

    switch (section) {
        case 'all':
            console.log('All sections:');
            console.log();

            for (const sectionName of Object.keys(sections)) {
                printSection(sectionName as keyof typeof sections);
            }

            break;
        case 'sections':
            printSection('sections');
            break;
        case 'main':
            printSection('main');
            break;
        case 'download':
            printSection('download');
            break;
        case 'install':
            printSection('install');
            break;
        case 'link':
            printSection('link');
            break;
        case 'update':
            printSection('update');
            break;
        case 'versions':
            printSection('versions');
            break;
        default:
            console.error(`Invalid section: ${section}`);
            process.exit(1);
    }

    process.exit(0);
}

async function getLatestVersion(build: 'stable' | 'insider') {
    const _versions = await getVersions();

    const versions = _versions
        .filter(({ build: _build }) => _build === build);

    const osname = `linux-${process.arch}`;

    const platformVersion = versions
        .find(v => v.platform.os === osname);

    if (!platformVersion) {
        console.error(`No version found for ${osname}`);
        process.exit(1);
    }

    return platformVersion.hash;
}

function version(build?: 'all', binpath?: string): {
    stable: string;
    insiders: string;
};
function version(build: 'stable', binpath?: string): string;
function version(build: 'insiders', binpath?: string): string;
function version(build: 'stable' | 'insiders' | 'all' = 'all', binpath?: string) {
    if (build === 'all') {
        return {
            stable: version('stable'),
            insiders: version('insiders')
        };
    }

    if (build !== 'stable' && build !== 'insiders') {
        throw new Error(`Invalid build: ${build}`);
    }

    if (build === 'stable') {
        binpath = binpath || cp.execSync('which code').toString().trim();

        const version = cp.execSync(`${binpath} --version`).toString().split('\n')[1].trim();

        return version;
    } else {
        binpath = binpath || cp.execSync('which code-insiders').toString().trim();

        const packagejson = JSON.parse(fs.readFileSync(path.join(path.dirname(binpath), 'resources', 'app', 'package.json')).toString());

        const version = packagejson.distro;

        return version;
    }
}

async function downloadAction(double: {
    [key: string]: string | boolean
}, single: {
    [key: string]: string | boolean
}): Promise<string> {
    return new Promise((resolve) => {
        const build = double['build'] || single['b'] || 'stable';

        if (typeof build !== 'string') {
            console.error(`Invalid build: ${build}`);
            process.exit(1);
        }

        if (!['stable', 'insiders'].includes(build)) {
            console.error(`Invalid build: ${build}`);
            process.exit(1);
        }

        const os =
            process.platform === 'win32'
                ? `win32-${process.arch}-archive`
                : process.platform === 'darwin'
                    ? 'darwin-universal'
                    : process.platform === 'linux'
                        ? `linux-${process.arch}`
                        : 'unknown';

        if (os === 'unknown') {
            console.error(`Unsupported platform: ${process.platform}`);
            process.exit(1);
        }

        const url = `https://code.visualstudio.com/sha/download?build=${build === 'insiders' ? 'insider' : build}&os=${os}`;
        const filename = double['filename'] || single['f'] || `vscode-${build}-${os}-${Date.now()}.${process.platform === 'linux' ? 'tar.gz' : 'zip'}`;
        const downloadDir = double['download-directory'] || single['d'] || path.join(process.cwd(), 'downloads');

        if (typeof filename !== 'string') {
            console.error(`Invalid filename: ${filename}`);
            process.exit(1);
        }
        if (typeof downloadDir !== 'string') {
            console.error(`Invalid download directory: ${downloadDir}`);
            process.exit(1);
        }

        const downloadPath = path.join(downloadDir, filename);

        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        console.log(`Downloading ${url} to ${downloadPath}`);

        const file = fs.createWriteStream(downloadPath);

        const request = https.get(url, response => {
            if (response.statusCode === 302) {
                console.log(`Redirecting to ${response.headers.location}`);
                request.abort();
                https.get(response.headers.location, response => {
                    handleRes(response, filename, file);
                }).on('error', error => {
                    console.error(error);
                    process.exit(1);
                }).on('end', () => {
                    console.log(`Downloaded ${filename}`);
                    process.exit(0);
                });
            } else {
                handleRes(response, filename, file);
            }
        });

        file.on('finish', () => {
            file.close();
            console.log(`\nDownloaded ${filename} to ${downloadDir}`);
            resolve(path.join(downloadDir, filename));
        });

        request.on('error', error => {
            console.error(error);
            process.exit(1);
        });
    });
}

async function installAction(double: {
    [key: string]: string | boolean
}, single: {
    [key: string]: string | boolean
}) {
    const file = double['file'] || single['f'];
    const build =
        double['insiders'] || single['i']
            ? 'insiders' :
            double['stable'] || single['s']
                ? 'stable' :
                double['build'] || single['b'] || 'stable';
    const dir = double['install-directory'] || single['d'] || (process.platform === 'win32'
        ? path.join(process.env.LOCALAPPDATA, 'Programs', `Microsoft VS Code${build === 'insiders' ? ' Insiders' : ''}`)
        : process.platform === 'darwin'
            ? path.join(process.env.HOME, 'Applications', `Visual Studio Code${build === 'insiders' ? ' - Insiders' : ''}`)
            : `/usr/share/code${build === 'insiders' ? '-insiders' : ''}`);

    if (typeof file !== 'string') {
        console.error(`Invalid file: ${file}`);
        process.exit(1);
    }

    if (typeof build !== 'string') {
        console.error(`Invalid build: ${build}`);
        process.exit(1);
    }

    if (typeof dir !== 'string') {
        console.error(`Invalid install directory: ${dir}`);
        process.exit(1);
    }

    if (!file) {
        console.error('Missing file');
        process.exit(1);
    }

    if (!fs.existsSync(file)) {
        console.error(`File ${file} does not exist`);
        process.exit(1);
    }

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (process.platform === 'linux') {
        try {
            fs.accessSync(dir, fs.constants.W_OK);
        } catch (error) {
            console.error(`Directory ${dir} is not writable, please run as root (sudo)`);
            process.exit(1);
        }

        console.log(`Installing ${file} to ${dir}`);

        tar.x({
            file: file,
            cwd: dir,
            strip: 1
        }).then(() => {
            console.log(`Installed ${file} to ${dir}`);
            process.exit(0);
        });
    } else {
        console.log(`Installing ${file} to ${dir}`);

        const zip = new AdmZip(file);
        zip.extractAllTo(dir, true);

        console.log(`Installed ${file} to ${dir}`);
        process.exit(0);
    }
}

async function linkAction(double: {
    [key: string]: string | boolean
}, single: {
    [key: string]: string | boolean
}) {
    const build = double['build'] || single['b'] || 'stable';

    if (typeof build !== 'string') {
        console.error(`Invalid build: ${build}`);
        process.exit(1);
    }

    const dir = double['install-directory'] || single['d'] || (process.platform === 'linux'
        ? `/usr/share/code${build === 'insiders' ? '-insiders' : ''}` :
        process.platform === 'win32'
            ? path.join(process.env.LOCALAPPDATA, 'Programs', `Microsoft VS Code${build === 'insiders' ? ' Insiders' : ''}`)
            : path.join(process.env.HOME, 'Applications', `Visual Studio Code${build === 'insiders' ? ' - Insiders' : ''}`));

    if (typeof dir !== 'string') {
        console.error(`Invalid install directory: ${dir}`);
        process.exit(1);
    }

    const bindir = path.join(dir, 'bin');

    if (!fs.existsSync(bindir)) {
        console.error(`Directory ${bindir} does not exist`);
        process.exit(1);
    }

    const symlinkdir = double['symlink-directory']
        ? double['symlink-directory'] :
        single['s']
            ? single['s'] :
            (process.platform === 'linux' ? '/usr/bin' : path.join(process.env.HOME, 'bin'));

    if (typeof symlinkdir !== 'string') {
        console.error(`Invalid symlink directory: ${symlinkdir}`);
        process.exit(1);
    }

    if (!fs.existsSync(symlinkdir)) {
        console.error(`Directory ${symlinkdir} does not exist`);
        process.exit(1);
    }

    console.log(`Linking ${bindir} to ${symlinkdir}`);

    if (process.platform === 'win32') {
        console.log('Link not needed on Windows');
        process.exit(0);
    }

    try {
        fs.accessSync(bindir, fs.constants.W_OK);
    } catch (error) {
        console.error(`Directory ${bindir} is not writable, please run as root (sudo)`);
        process.exit(1);
    }

    if (!fs.readdirSync(bindir).includes(`code${build === 'insiders' ? '-insiders' : ''}`)) {
        console.error(`File code${build === 'insiders' ? '-insiders' : ''} does not exist`);
        process.exit(1);
    }

    fs.symlinkSync(path.join(bindir, `code${build === 'insiders' ? '-insiders' : ''}`), path.join(symlinkdir, `code${build === 'insiders' ? '-insiders' : ''}`), 'file');
}

async function updateAction(double: {
    [key: string]: string | boolean
}, single: {
    [key: string]: string | boolean
}) {
    const build = double['build'] || single['b'] || 'stable';

    if (typeof build !== 'string') {
        console.error(`Invalid build: ${build}`);
        process.exit(1);
    }

    const dir = double['install-directory'] || single['d'] || (process.platform === 'linux'
        ? `/usr/share/code${build === 'insiders' ? '-insiders' : ''}` :
        process.platform === 'win32'
            ? path.join(process.env.LOCALAPPDATA, 'Programs', `Microsoft VS Code${build === 'insiders' ? ' Insiders' : ''}`)
            : path.join(process.env.HOME, 'Applications', `Visual Studio Code${build === 'insiders' ? ' - Insiders' : ''}`));

    if (typeof dir !== 'string') {
        console.error(`Invalid install directory: ${dir}`);
        process.exit(1);
    }

    if (!fs.existsSync(dir)) {
        console.error(`Directory ${dir} does not exist`);
        process.exit(1);
    }

    const bindir = path.join(dir, 'bin');

    if (!fs.existsSync(bindir)) {
        console.error(`Directory ${bindir} does not exist`);
        process.exit(1);
    }

    if (process.platform === 'linux') {
        try {
            fs.accessSync(bindir, fs.constants.W_OK);
        } catch (error) {
            console.error(`Directory ${bindir} is not writable, please run as root (sudo)`);
            process.exit(1);
        }
    }

    console.log(`Updating ${bindir}`);

    if (process.platform === 'linux') {
        const execpath = cp.execSync('which code' + (build === 'insiders' ? '-insiders' : '')).toString().trim();

        if (execpath === '') {
            console.error(`File code${build === 'insiders' ? '-insiders' : ''} does not exist`);
            process.exit(1);
        }

        let version = '';

        if (build === 'stable') {
            version = cp.execSync(execpath + ' --version').toString().trim().split('\n')[1].trim();
        } else {
            const versionfile = path.join(bindir, '..', 'resources', 'app', 'package.json');
            const versionjson = JSON.parse(fs.readFileSync(versionfile, 'utf8'));
            version = versionjson.distro;
        }

        const versions = await getVersions();

        const osname = `linux-${process.arch}`;

        const platformVersion = versions
            .find(v => v.platform.os === osname);

        if (!platformVersion) {
            console.error(`No version found for ${osname}`);
            process.exit(1);
        }

        if (platformVersion.version === version) {
            console.log(`Already up to date: ${version}`);
            process.exit(0);
        }

        const file = await downloadAction(double, single);

        await installAction({
            ...double,
            file
        }, single);
    }
}

async function versionsAction(double: {
    [key: string]: string | boolean
}, single: {
    [key: string]: string | boolean
}) {
    const build = double['build'] || single['b'] || 'all';

    if (typeof build !== 'string') {
        console.error(`Invalid build: ${build}`);
        process.exit(1);
    }

    if (build !== 'all' && build !== 'stable' && build !== 'insiders') {
        console.error(`Invalid build: ${build}`);
        process.exit(1);
    }

    if (build === 'all') {
        const [stable, insiders] = await Promise.all([getLatestVersion('stable'), getLatestVersion('insider')]);

        console.log(`Latest Stable Version: ${stable}`);
        console.log(`Latest Insiders Version: ${insiders}`);

        const {
            stable: currentStable,
            insiders: currentInsiders
        } = version();

        console.log(`Current Stable Version: ${currentStable}`);
        console.log(`Current Insiders Version: ${currentInsiders}`);
    }
}

async function main() {
    if (action === 'help') {
        helpAction(double, single);
    } else if (action === 'download') {
        downloadAction(double, single);
    } else if (action === 'install') {
        installAction(double, single);
    } else if (action === 'link') {
        linkAction(double, single);
    } else if (action === 'update') {
        updateAction(double, single);
    } else if (action === 'versions') {
        versionsAction(double, single);
    }
}

main();
