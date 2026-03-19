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
        // onerror: resolve mesmo em falha de rede (CSS é cosmético, não bloqueia)
        // setTimeout: fallback para bug de browser onde link.onload não dispara para recursos em cache
        const done = () => resolve();
        link.onload = done;
        link.onerror = done;
        document.head.appendChild(link);
        setTimeout(done, 4000); // máximo 4s de espera por CSS
    });
}

function loadJS(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => {
            console.error('[Libs] Falha ao carregar:', src);
            resolve(); // resolve mesmo assim para não travar o resto
        };
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
