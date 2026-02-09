// Carrega todas as bibliotecas necessarias
const LIBS = {
    css: [
        'https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/css/tabler.min.css',
        'https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/css/tabler-vendors.min.css',
        'https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css',
        'https://cdn.jsdelivr.net/npm/izitoast@1.4.0/dist/css/iziToast.min.css',
        'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css'
    ],
    js: [
        'https://code.jquery.com/jquery-4.0.0-beta.min.js',
        'https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/js/tabler.min.js',
        'https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js',
        'https://cdn.datatables.net/1.13.7/js/dataTables.bootstrap5.min.js',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
        'https://cdn.jsdelivr.net/npm/izitoast@1.4.0/dist/js/iziToast.min.js',
        'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js',
        'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
    ]
};

function loadCSS(href) {
    return new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        document.head.appendChild(link);
    });
}

function loadJS(src) {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        document.body.appendChild(script);
    });
}

async function loadLibs() {
    await Promise.all(LIBS.css.map(loadCSS));
    for (const src of LIBS.js) {
        await loadJS(src);
    }
    console.log('[Libs] Todas as bibliotecas carregadas, disparando evento libsLoaded');
    document.dispatchEvent(new Event('libsLoaded'));
}

loadLibs();
