#!/usr/bin/env python3
"""
Controle Operações – Test Dashboard Server
Serve o dashboardTestes.html e fornece API SSE para execução real dos testes.
Porta padrão: 8883
"""

import os
import sys
import re
import time
import json
import socket
import subprocess
import threading
import urllib.request
import urllib.error
from pathlib import Path

from flask import Flask, Response, jsonify, send_from_directory, request
from flask import stream_with_context

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS_DIR  = os.path.join(BASE_DIR, 'tests')
BACKEND_TESTS_DIR  = os.path.join(BASE_DIR, 'backend', 'tests')
FRONTEND_TESTS_DIR = os.path.join(BASE_DIR, 'frontend', 'tests')
RESULTS_DIR = os.path.join(TESTS_DIR, 'results')
PYTEST_JSON = os.path.join(RESULTS_DIR, 'pytest_results.json')
PW_JSON     = os.path.join(RESULTS_DIR, 'playwright_results.json')
AI_JSON     = os.path.join(RESULTS_DIR, 'ai_results.json')

FLASK_PORT     = 8888
DASHBOARD_PORT = 8883
E2E_JSON    = os.path.join(RESULTS_DIR, 'e2e_results.json')

app = Flask(__name__)

_run_lock  = threading.Lock()
_flask_proc = None


# ─── utilidades ────────────────────────────────────────────────────────────────

def is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(('localhost', port)) == 0


def sse(event: str, data) -> str:
    return f'event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n'


# ─── Flask server lifecycle ─────────────────────────────────────────────────────

def start_flask_server() -> bool:
    global _flask_proc
    server_path = os.path.join(BASE_DIR, 'backend', 'server.py')
    _flask_proc = subprocess.Popen(
        [sys.executable, server_path],
        cwd=BASE_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(20):
        time.sleep(0.3)
        if is_port_open(FLASK_PORT):
            return True
    return False


def stop_flask_server():
    global _flask_proc
    if _flask_proc:
        _flask_proc.terminate()
        try:
            _flask_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _flask_proc.kill()
        _flask_proc = None


# ─── parsers de linha ───────────────────────────────────────────────────────────

_RE_PYTEST = re.compile(
    r'((?:backend[\\/])?tests[\\/]\S+\.py)::(\w+)::(\S+)\s+(PASSED|FAILED|ERROR)'
)

_RE_PW_LINE = re.compile(
    r'([✓✔✘×])\s+(?:\[chromium\]\s*›\s*)?'
    r'(?:[\w./\\]+\.spec\.js\s*:\d+:\d+\s*›\s+)?'
    r'(.+?)\s*›\s*(.+?)\s+\(([\d.]+)s\)',
    re.UNICODE
)


def parse_pytest_line(line: str):
    m = _RE_PYTEST.search(line)
    if not m:
        return None
    path, suite, name, outcome = m.groups()
    return {
        'file':  os.path.basename(path).replace('.py', ''),
        'suite': suite,
        'name':  name,
        'type':  'backend',
        'status': 'pass' if outcome == 'PASSED' else 'fail',
        'dur': 0,
        'errorMessage': None,
        'traceback':    None,
        'location':     None,
    }


def parse_pw_line(line: str):
    m = _RE_PW_LINE.search(line)
    if not m:
        return None
    mark, suite, name, dur_s = m.groups()
    passed = mark in ('✓', '✔')
    return {
        'file':   'playwright',
        'suite':  suite.strip(),
        'name':   name.strip(),
        'type':   'frontend',
        'status': 'pass' if passed else 'fail',
        'dur':    int(float(dur_s) * 1000),
        'errorMessage': None,
        'traceback':    None,
        'location':     None,
    }


# ─── carregamento de resultados ─────────────────────────────────────────────────

def load_pytest_results():
    if not os.path.exists(PYTEST_JSON):
        return []
    with open(PYTEST_JSON, encoding='utf-8') as f:
        data = json.load(f)
    results = []
    for t in data.get('tests', []):
        nodeid = t.get('nodeid', '')
        parts  = nodeid.split('::')
        file_s = os.path.basename(parts[0]).replace('.py', '') if parts else 'unknown'
        suite  = parts[1] if len(parts) > 1 else 'unknown'
        name   = parts[2] if len(parts) > 2 else nodeid
        outcome = t.get('outcome', 'passed')
        call    = t.get('call') or {}
        dur     = int((call.get('duration') or 0) * 1000)
        crash   = call.get('crash') or {}
        err_msg = crash.get('message') or call.get('longrepr') or None
        tb_str  = call.get('longrepr') or None
        loc     = f"{crash.get('path','').replace(BASE_DIR,'').lstrip('/\\\\')}:{crash.get('lineno','')}" if crash.get('lineno') else None
        results.append({
            'file': file_s, 'suite': suite, 'name': name,
            'type': 'backend',
            'status': 'pass' if outcome == 'passed' else 'fail',
            'dur':  dur if dur > 0 else 10,
            'errorMessage': err_msg,
            'traceback':    tb_str,
            'location':     loc,
        })
    return results


def load_pw_results():
    if not os.path.exists(PW_JSON):
        return []
    with open(PW_JSON, encoding='utf-8') as f:
        data = json.load(f)
    results = []

    def walk(suite, parent_file=''):
        file_hint = suite.get('file') or parent_file
        file_s = os.path.basename(file_hint).replace('.spec.js', '.spec') if file_hint else 'playwright'
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                rlist = test.get('results') or [{}]
                r = rlist[0]
                status   = r.get('status', 'passed')
                dur      = int(r.get('duration') or 0)
                errors   = r.get('errors') or []
                err_msg, tb_str, loc = None, None, None
                if errors:
                    e = errors[0]
                    err_msg = e.get('message', '')
                    tb_str  = e.get('stack', '')
                    eloc    = e.get('location') or {}
                    if eloc.get('line'):
                        loc = f"{os.path.basename(eloc.get('file',''))}:{eloc.get('line','')}"
                results.append({
                    'file':   file_s,
                    'suite':  suite.get('title', ''),
                    'name':   spec.get('title', ''),
                    'type':   'frontend',
                    'status': 'pass' if status == 'passed' else 'fail',
                    'dur':    dur,
                    'errorMessage': err_msg,
                    'traceback':    tb_str,
                    'location':     loc,
                })
        for child in suite.get('suites', []):
            walk(child, file_hint)

    for top in data.get('suites', []):
        walk(top)
    return results


def load_ai_results():
    """Carrega resultados JSON dos testes de IA."""
    if not os.path.exists(AI_JSON):
        return []
    try:
        with open(AI_JSON, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def load_e2e_results():
    """Carrega resultados JSON dos testes E2E (e2e-usuario)."""
    if not os.path.exists(E2E_JSON):
        return []
    try:
        with open(E2E_JSON, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def load_all_results():
    tests  = load_pytest_results() + load_pw_results() + load_ai_results() + load_e2e_results()
    passed = sum(1 for t in tests if t['status'] == 'pass')
    failed = sum(1 for t in tests if t['status'] == 'fail')
    total  = len(tests)
    health = round(passed / total * 100) if total > 0 else 0
    be_dur  = sum(t['dur'] for t in tests if t['type'] == 'backend')
    fe_dur  = sum(t['dur'] for t in tests if t['type'] == 'frontend')
    ai_dur  = sum(t['dur'] for t in tests if t['type'] == 'ai')
    e2e_dur = sum(t['dur'] for t in tests if t['type'] == 'e2e')
    return {
        'tests': tests,
        'summary': {
            'total':     total,
            'passed':    passed,
            'failed':    failed,
            'health':    health,
            'duration':  round((be_dur + fe_dur + ai_dur + e2e_dur) / 1000, 1),
            'be_count':  sum(1 for t in tests if t['type'] == 'backend'),
            'fe_count':  sum(1 for t in tests if t['type'] == 'frontend'),
            'ai_count':  sum(1 for t in tests if t['type'] == 'ai'),
            'e2e_count': sum(1 for t in tests if t['type'] == 'e2e'),
        }
    }


# ─── runner SSE ────────────────────────────────────────────────────────────────

def run_stream(be_nodes='', fe_grep='', skip_be=False, skip_fe=False, skip_ai=False, ai_nodes='',
               skip_e2e=True, e2e_grep='', e2e_headed=False, e2e_screenshots='on-error',
               e2e_cleanup_after=False):
    """Generator que emite eventos SSE enquanto os testes rodam (backend + frontend + ai + e2e)."""
    global _flask_proc
    flask_started = False
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # 1. verifica / sobe Flask
    yield sse('log', {'type': 'info', 'msg': '[INFO] Verificando servidor Flask em localhost:8888...'})
    if not is_port_open(FLASK_PORT):
        yield sse('log', {'type': 'info', 'msg': '[INFO] Servidor não encontrado. Iniciando Flask...'})
        if start_flask_server():
            flask_started = True
            yield sse('log', {'type': 'ok', 'msg': '[OK] Servidor Flask iniciado.'})
        else:
            yield sse('log', {'type': 'fail', 'msg': '[ERRO] Não foi possível iniciar o Flask.'})
            yield sse('complete', {'error': 'flask_start_failed'})
            return
    else:
        yield sse('log', {'type': 'ok', 'msg': '[OK] Servidor Flask já está ativo na porta 8888.'})

    try:
        # 2. pytest
        if skip_be:
            yield sse('log', {'type': 'warn', 'msg': '[SKIP] Testes backend ignorados (nenhum selecionado).'})
            be_pass = be_fail = 0
        else:
            yield sse('log', {'type': 'info', 'msg': '[INFO] Executando testes backend (pytest)...'})
            if be_nodes:
                node_list = [n.strip() for n in be_nodes.split('|') if n.strip()]
                cmd = [sys.executable, '-m', 'pytest'] + node_list + [
                    '-v',
                    '--json-report', f'--json-report-file={PYTEST_JSON}',
                    '--tb=short',
                ]
            else:
                cmd = [
                    sys.executable, '-m', 'pytest', 'backend/tests/', '-v',
                    '--json-report', f'--json-report-file={PYTEST_JSON}',
                    '--tb=short',
                ]
            env = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace',
                cwd=BASE_DIR, env=env
            )
            be_pass = be_fail = 0
            for line in proc.stdout:
                line = line.rstrip()
                if not line:
                    continue
                t = parse_pytest_line(line)
                if t:
                    if t['status'] == 'pass':
                        be_pass += 1
                    else:
                        be_fail += 1
                    yield sse('test', t)
                ltype = ('ok'   if ('PASSED' in line or 'passed' in line) else
                         'fail' if ('FAILED' in line or 'ERROR' in line)  else 'info')
                yield sse('log', {'type': ltype, 'msg': line[:250]})
            proc.wait()

            # enriquece erros do pytest
            if os.path.exists(PYTEST_JSON):
                with open(PYTEST_JSON, encoding='utf-8') as f:
                    pdata = json.load(f)
                for t in pdata.get('tests', []):
                    if t.get('outcome') == 'failed':
                        parts = t.get('nodeid', '').split('::')
                        call  = t.get('call') or {}
                        crash = call.get('crash') or {}
                        yield sse('test_detail', {
                            'suite': parts[1] if len(parts) > 1 else '',
                            'name':  parts[2] if len(parts) > 2 else '',
                            'type':  'backend',
                            'errorMessage': crash.get('message') or call.get('longrepr'),
                            'traceback':    call.get('longrepr'),
                            'location': f"backend/tests/{os.path.basename(parts[0])}:{crash.get('lineno','')}" if crash.get('lineno') else None,
                        })

            yield sse('log', {'type': 'ok',
                              'msg': f'[OK] Backend: {be_pass} passou | {be_fail} falhou'})

        # 3. playwright
        if skip_fe:
            yield sse('log', {'type': 'warn', 'msg': '[SKIP] Testes frontend ignorados (nenhum selecionado).'})
            fe_pass = fe_fail = 0
        else:
            yield sse('log', {'type': 'info', 'msg': '[INFO] Executando testes frontend (Playwright / Chromium)...'})
            if fe_grep:
                pw_cmd = f'npx playwright test --grep "{fe_grep}"'
            else:
                pw_cmd = 'npx playwright test'
            pw_proc = subprocess.Popen(
                pw_cmd,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace',
                cwd=BASE_DIR, shell=True
            )
            fe_pass = fe_fail = 0
            for line in pw_proc.stdout:
                line = line.rstrip()
                if not line:
                    continue
                t = parse_pw_line(line)
                if t:
                    if t['status'] == 'pass':
                        fe_pass += 1
                    else:
                        fe_fail += 1
                    yield sse('test', t)
                ltype = ('ok'   if 'passed' in line.lower() else
                         'fail' if 'failed' in line.lower() else 'info')
                yield sse('log', {'type': ltype, 'msg': line[:250]})
            pw_proc.wait()

            # enriquece erros do playwright
            if os.path.exists(PW_JSON):
                for t in load_pw_results():
                    if t['status'] == 'fail' and t.get('errorMessage'):
                        yield sse('test_detail', {
                            'suite': t['suite'], 'name': t['name'], 'type': 'frontend',
                            'errorMessage': t['errorMessage'],
                            'traceback':    t['traceback'],
                            'location':     t['location'],
                        })

            yield sse('log', {'type': 'ok',
                              'msg': f'[OK] Frontend: {fe_pass} passou | {fe_fail} falhou'})

        # 4. testes de IA (live_api)
        if skip_ai:
            yield sse('log', {'type': 'warn', 'msg': '[SKIP] Testes de IA ignorados (nenhum selecionado).'})
            ai_pass = ai_fail = 0
        else:
            if ai_nodes:
                node_list = [n.strip() for n in ai_nodes.split('|') if n.strip()]
                label = f'{len(node_list)} teste(s) de IA selecionado(s)'
                yield sse('log', {'type': 'info', 'msg': f'[INFO] Executando {label}...'})
                ai_cmd = [
                    sys.executable, '-m', 'pytest',
                    *node_list,
                    '-v',
                    '--json-report', f'--json-report-file={AI_JSON}',
                    '--tb=short',
                ]
            else:
                yield sse('log', {'type': 'info', 'msg': '[INFO] Executando testes de IA (pytest -m live_api)...'})
                ai_cmd = [
                    sys.executable, '-m', 'pytest',
                    'backend/tests/test_ai_providers.py',
                    '-m', 'live_api', '-v',
                    '--json-report', f'--json-report-file={AI_JSON}',
                    '--tb=short',
                ]
            ai_env = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
            ai_proc = subprocess.Popen(
                ai_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace',
                cwd=BASE_DIR, env=ai_env
            )
            ai_pass = ai_fail = 0
            for line in ai_proc.stdout:
                line = line.rstrip()
                if not line:
                    continue
                m = _RE_PYTEST.search(line)
                if m:
                    path, suite, name, outcome = m.groups()
                    t = {
                        'file':  'test_ai_providers',
                        'suite': suite,
                        'name':  name,
                        'type':  'ai',
                        'status': 'pass' if outcome == 'PASSED' else 'fail',
                        'dur': 0,
                        'errorMessage': None,
                        'traceback':    None,
                        'location':     None,
                    }
                    if t['status'] == 'pass': ai_pass += 1
                    else: ai_fail += 1
                    yield sse('test', t)
                ltype = ('ok'   if ('PASSED' in line or 'passed' in line) else
                         'fail' if ('FAILED' in line or 'ERROR' in line)  else 'info')
                yield sse('log', {'type': ltype, 'msg': line[:250]})
            ai_proc.wait()

            # Enriquece erros dos testes de IA
            if os.path.exists(AI_JSON):
                with open(AI_JSON, encoding='utf-8') as f:
                    aidata = json.load(f)
                for t in aidata.get('tests', []):
                    if t.get('outcome') == 'failed':
                        parts = t.get('nodeid', '').split('::')
                        call  = t.get('call') or {}
                        crash = call.get('crash') or {}
                        yield sse('test_detail', {
                            'suite': parts[1] if len(parts) > 1 else '',
                            'name':  parts[2] if len(parts) > 2 else '',
                            'type':  'ai',
                            'errorMessage': crash.get('message') or call.get('longrepr'),
                            'traceback':    call.get('longrepr'),
                            'location': f"backend/tests/test_ai_providers.py:{crash.get('lineno','')}" if crash.get('lineno') else None,
                        })

            # Salva resultados de IA em ai_results.json
            ai_tests_results = load_ai_results_from_json()
            with open(AI_JSON, 'w', encoding='utf-8') as f:
                json.dump(ai_tests_results, f, ensure_ascii=False)

            yield sse('log', {'type': 'ok',
                              'msg': f'[OK] IA: {ai_pass} passou | {ai_fail} falhou'})

        # 5. testes E2E usuário (playwright.usuario.config.js)
        if skip_e2e:
            yield sse('log', {'type': 'warn', 'msg': '[SKIP] Testes E2E ignorados (nenhum selecionado).'})
            e2e_pass = e2e_fail = 0
        else:
            yield sse('log', {'type': 'info', 'msg': '[INFO] Executando testes E2E de simulação de usuário...'})
            pw_flags = '--config=playwright.usuario.config.js'
            if e2e_headed:
                pw_flags += ' --headed'
            # Mapeia setting de screenshots para variável de ambiente que o spec pode ler
            screenshot_env = {**os.environ, 'PYTHONIOENCODING': 'utf-8',
                              'PW_SCREENSHOTS': e2e_screenshots,
                              'PW_HEADED': '1' if e2e_headed else '0',
                              'PW_SLOW_MO': '300' if e2e_headed else '0',
                              'E2E_SCREENSHOTS': e2e_screenshots}
            if e2e_grep:
                pw_flags += f' --grep "{e2e_grep}"'
            e2e_cmd = f'npx playwright test {pw_flags} --reporter=line'
            e2e_proc = subprocess.Popen(
                e2e_cmd,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace',
                cwd=BASE_DIR, shell=True, env=screenshot_env
            )
            e2e_pass = e2e_fail = 0
            e2e_raw_output = []
            for line in e2e_proc.stdout:
                line = line.rstrip()
                if not line:
                    continue
                e2e_raw_output.append(line)
                t = parse_pw_line(line)
                if t:
                    t['type'] = 'e2e'
                    if t['status'] == 'pass':
                        e2e_pass += 1
                    else:
                        e2e_fail += 1
                    yield sse('test', t)
                ltype = ('ok'   if 'passed' in line.lower() else
                         'fail' if 'failed' in line.lower() else 'info')
                yield sse('log', {'type': ltype, 'msg': line[:250]})
            e2e_proc.wait()

            # Limpeza de dados de teste (opcional, configurável no dashboard)
            if e2e_cleanup_after:
                try:
                    import urllib.request as _urlreq
                    _req = _urlreq.Request(
                        'http://localhost:8888/api/opcoes/test-data',
                        data=b'', method='DELETE'
                    )
                    with _urlreq.urlopen(_req, timeout=5) as _resp:
                        import json as _json
                        _body = _json.loads(_resp.read())
                        nd = _body.get('deleted', '?')
                    yield sse('log', {'type': 'ok', 'msg': f'[OK] {nd} dados de teste E2E removidos do banco.'})
                except Exception as _ce:
                    yield sse('log', {'type': 'warn', 'msg': f'[WARN] Cleanup dados teste falhou: {_ce}'})

            # Tenta parsear saída JSON do playwright reporter
            e2e_tests_results = []
            json_str = '\n'.join(e2e_raw_output)
            # Playwright --reporter=json pode imprimir para stdout
            try:
                json_start = json_str.find('{')
                if json_start >= 0:
                    pw_json_data = json.loads(json_str[json_start:])
                    for spec in pw_json_data.get('suites', []):
                        def walk_e2e(suite, file_hint=''):
                            fh = suite.get('file', file_hint or suite.get('title', ''))
                            for test in suite.get('specs', []):
                                res = test.get('tests', [{}])[0]
                                status = res.get('status', 'skipped')
                                dur = sum(r.get('duration', 0) for r in res.get('results', []))
                                e2e_tests_results.append({
                                    'file':  os.path.basename(fh).replace('.spec.js','') if fh else 'e2e-usuario',
                                    'suite': suite.get('title', ''),
                                    'name':  test.get('title', ''),
                                    'type':  'e2e',
                                    'status': 'pass' if status == 'passed' else 'fail',
                                    'dur':   int(dur),
                                    'errorMessage': None,
                                    'traceback': None,
                                    'location': None,
                                })
                            for child in suite.get('suites', []):
                                walk_e2e(child, fh)
                        walk_e2e(spec)
            except Exception:
                pass

            if e2e_tests_results:
                os.makedirs(RESULTS_DIR, exist_ok=True)
                with open(E2E_JSON, 'w', encoding='utf-8') as f:
                    json.dump(e2e_tests_results, f, ensure_ascii=False)
            else:
                # Fallback: tenta ler o arquivo json gerado pelo playwright.usuario.config.js
                e2e_raw_path = os.path.join(RESULTS_DIR, 'e2e_raw.json')
                if os.path.exists(e2e_raw_path):
                    try:
                        with open(e2e_raw_path, encoding='utf-8') as f:
                            pw_data = json.load(f)
                        fb_results = []
                        def walk_fb(suite, fh=''):
                            fh = suite.get('file', fh or suite.get('title', ''))
                            for spec in suite.get('specs', []):
                                res   = spec.get('tests', [{}])[0]
                                dur   = sum(r.get('duration', 0) for r in res.get('results', []))
                                stat  = res.get('status', 'skipped')
                                fb_results.append({
                                    'file':  os.path.basename(fh).replace('.spec.js','') if fh else 'e2e-usuario',
                                    'suite': suite.get('title', ''),
                                    'name':  spec.get('title', ''),
                                    'type':  'e2e',
                                    'status': 'pass' if stat == 'passed' else 'fail',
                                    'dur':   int(dur),
                                    'errorMessage': None, 'traceback': None, 'location': None,
                                })
                            for child in suite.get('suites', []):
                                walk_fb(child, fh)
                        for top in pw_data.get('suites', []):
                            walk_fb(top)
                        if fb_results:
                            with open(E2E_JSON, 'w', encoding='utf-8') as f:
                                json.dump(fb_results, f, ensure_ascii=False)
                    except Exception:
                        pass

            if e2e_proc.returncode != 0 and e2e_pass == 0 and e2e_fail == 0:
                yield sse('log', {'type': 'fail',
                                  'msg': f'[ERRO] E2E: processo retornou código {e2e_proc.returncode}. Verifique o log acima.'})
            e2e_log_type = 'ok' if (e2e_pass > 0 and e2e_fail == 0) else 'fail' if e2e_fail > 0 else 'warn'
            e2e_log_pfx  = '[OK]' if e2e_log_type == 'ok' else '[FAIL]' if e2e_log_type == 'fail' else '[WARN]'
            yield sse('log', {'type': e2e_log_type,
                              'msg': f'{e2e_log_pfx} E2E: {e2e_pass} passou | {e2e_fail} falhou'})

        # 6. payload final
        results = load_all_results()
        results['summary'].update({'be_pass': be_pass, 'be_fail': be_fail,
                                   'fe_pass': fe_pass, 'fe_fail': fe_fail,
                                   'ai_pass': ai_pass, 'ai_fail': ai_fail,
                                   'e2e_pass': e2e_pass, 'e2e_fail': e2e_fail})
        total   = results['summary']['total']
        passed  = results['summary']['passed']
        failed  = results['summary']['failed']
        color   = 'ok' if failed == 0 else 'fail'
        yield sse('complete', results)

        yield sse('log', {'type': color,
                          'msg': f'[RESUMO] {passed}/{total} testes passaram'
                                 + (f' | {failed} FALHOU' if failed else ' ✓ TODOS OK!')})

    finally:
        if flask_started:
            yield sse('log', {'type': 'info', 'msg': '[INFO] Encerrando servidor Flask...'})
            stop_flask_server()
            yield sse('log', {'type': 'ok', 'msg': '[OK] Servidor Flask encerrado.'})


def load_ai_results_from_json():
    """Lê o AI_JSON gerado pelo pytest e retorna lista de resultados com type='ai'."""
    if not os.path.exists(AI_JSON):
        return []
    try:
        with open(AI_JSON, encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return []
    results = []
    for t in data.get('tests', []):
        nodeid = t.get('nodeid', '')
        parts  = nodeid.split('::')
        suite  = parts[1] if len(parts) > 1 else 'unknown'
        name   = parts[2] if len(parts) > 2 else nodeid
        outcome = t.get('outcome', 'passed')
        call    = t.get('call') or {}
        dur     = int((call.get('duration') or 0) * 1000)
        crash   = call.get('crash') or {}
        results.append({
            'file':   'test_ai_providers',
            'suite':  suite,
            'name':   name,
            'type':   'ai',
            'status': 'pass' if outcome in ('passed', 'skipped') else 'fail',
            'dur':    dur if dur > 0 else 0,
            'errorMessage': crash.get('message') or call.get('longrepr') or None,
            'traceback':    call.get('longrepr') or None,
            'location':     f"backend/tests/test_ai_providers.py:{crash.get('lineno','')}" if crash.get('lineno') else None,
        })
    return results


# ─── rotas ─────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(TESTS_DIR, 'dashboardTestes.html')


@app.route('/<path:filename>')
def static_tests(filename):
    """Serve arquivos estáticos (css, js) da pasta tests/."""
    return send_from_directory(TESTS_DIR, filename)


def get_results_mtime() -> float:
    """Retorna o maior mtime dos arquivos de resultado."""
    mtime = 0.0
    for path in [PYTEST_JSON, PW_JSON, AI_JSON]:
        if os.path.exists(path):
            mtime = max(mtime, os.path.getmtime(path))
    return mtime


@app.route('/api/results')
def api_results():
    data = load_all_results()
    data['mtime'] = get_results_mtime()
    resp = jsonify(data)
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@app.route('/api/results/mtime')
def api_results_mtime():
    resp = jsonify({'mtime': get_results_mtime()})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


def scan_ai_tests():
    """Escaneia test_ai_providers.py e retorna testes com type='ai'."""
    tests = []
    fpath = Path(BACKEND_TESTS_DIR) / 'test_ai_providers.py'
    if not fpath.exists():
        return tests
    pat_class = re.compile(r'^class\s+(Test\w+)', re.MULTILINE)
    pat_func  = re.compile(r'^\s{4}def\s+(test_\w+)', re.MULTILINE)
    try:
        src = fpath.read_text(encoding='utf-8', errors='replace')
    except Exception:
        return tests
    class_spans = [(m.group(1), m.start(), m.end()) for m in pat_class.finditer(src)]
    for ci, (cname, cstart, cend) in enumerate(class_spans):
        cend_pos = class_spans[ci + 1][1] if ci + 1 < len(class_spans) else len(src)
        class_body = src[cstart:cend_pos]
        for fm in pat_func.finditer(class_body):
            tests.append({
                'file':   'test_ai_providers',
                'suite':  cname,
                'name':   fm.group(1),
                'type':   'ai',
                'status': 'pending',
                'dur':    0,
                'errorMessage': None,
                'traceback':    None,
                'location':     None,
            })
    return tests


def scan_backend_tests():
    """Escaneia backend/tests/test_*.py e extrai suites e testes via regex.
    Exclui test_ai_providers.py (tratado separadamente como grupo IA)."""
    tests = []
    pat_class = re.compile(r'^class\s+(Test\w+)', re.MULTILINE)
    pat_func  = re.compile(r'^\s{4}def\s+(test_\w+)', re.MULTILINE)
    for fpath in sorted(Path(BACKEND_TESTS_DIR).glob('test_*.py')):
        if fpath.name == 'test_ai_providers.py':
            continue  # vai para o grupo IA
        fname = fpath.stem  # ex: test_api_atendimento
        try:
            src = fpath.read_text(encoding='utf-8', errors='replace')
        except Exception:
            continue
        # Parse por classe e, dentro de cada classe, por funções de teste
        class_spans = [(m.group(1), m.start(), m.end()) for m in pat_class.finditer(src)]
        for ci, (cname, cstart, cend) in enumerate(class_spans):
            cend_pos = class_spans[ci + 1][1] if ci + 1 < len(class_spans) else len(src)
            class_body = src[cstart:cend_pos]
            for fm in pat_func.finditer(class_body):
                tests.append({
                    'file':   fname,
                    'suite':  cname,
                    'name':   fm.group(1),
                    'type':   'backend',
                    'status': 'pending',
                    'dur':    0,
                    'errorMessage': None,
                    'traceback':    None,
                    'location':     None,
                })
    return tests


def scan_frontend_tests():
    """Escaneia frontend/tests/pages/*.spec.js e extrai describe/test via regex."""
    tests = []
    pat_test_static = re.compile(r"^\s*test\s*\(\s*['\"](.+?)['\"]", re.MULTILINE)
    pat_test_tpl    = re.compile(r"^\s*test\s*\(\s*`(.+?)`\s*,", re.MULTILINE)
    pat_pages_block = re.compile(r"const\s+PAGES\s*=\s*\[(.*?)\]", re.DOTALL | re.IGNORECASE)
    pat_page_name   = re.compile(r"name:\s*['\"](.+?)['\"]")
    spec_dir = Path(FRONTEND_TESTS_DIR) / 'pages'
    if not spec_dir.exists():
        return tests
    for fpath in sorted(spec_dir.glob('*.spec.js')):
        if fpath.name == 'e2e-usuario.spec.js':
            continue  # tratado separadamente no grupo E2E
        try:
            src = fpath.read_text(encoding='utf-8', errors='replace')
        except Exception:
            continue
        # Determine suite name from first describe or filename
        suite_name = fpath.stem  # e.g. "atendimento.spec"

        # Try to extract static test names
        static = [m.group(1) for m in pat_test_static.finditer(src)]
        # Try to extract template literal test names and expand variable references
        templates = [m.group(1) for m in pat_test_tpl.finditer(src)]
        expanded = []
        if templates:
            # Look for PAGES/pages array to expand variables
            pb = pat_pages_block.search(src)
            page_names = pat_page_name.findall(pb.group(1)) if pb else []
            for tpl in templates:
                if '${pg.name}' in tpl or '${page.name}' in tpl or '${pg}' in tpl:
                    if page_names:
                        for pname in page_names:
                            resolved = tpl.replace('${pg.name}', pname).replace('${page.name}', pname).replace('${pg}', pname)
                            expanded.append(resolved)
                    else:
                        expanded.append(tpl.replace('${pg.name}', '*').replace('${page.name}', '*'))
                else:
                    expanded.append(tpl)

        all_names = static + expanded
        for name in all_names:
            tests.append({
                'file':   fpath.stem,
                'suite':  suite_name,
                'name':   name,
                'type':   'frontend',
                'status': 'pending',
                'dur':    0,
                'errorMessage': None,
                'traceback':    None,
                'location':     None,
            })
    return tests


def scan_e2e_tests():
    """Escaneia e2e-usuario.spec.js e retorna testes com type='e2e'."""
    tests = []
    fpath = Path(FRONTEND_TESTS_DIR) / 'pages' / 'e2e-usuario.spec.js'
    if not fpath.exists():
        return tests
    pat_test_static = re.compile(r"^\s*test\s*\(\s*['\"](.+?)['\"]", re.MULTILINE)
    try:
        src = fpath.read_text(encoding='utf-8', errors='replace')
    except Exception:
        return tests
    static = [m.group(1) for m in pat_test_static.finditer(src)]
    # Para o template `[E2E-Usuario-Opcoes-FX${...}]`, adiciona entrée genérica
    if 'E2E-Usuario-Opcoes-FX' in src:
        import json as _json
        fixtures_path = Path(FRONTEND_TESTS_DIR) / 'fixtures' / 'opcoes-fixtures.json'
        try:
            fx = _json.loads(fixtures_path.read_text(encoding='utf-8'))
            for idx, op in enumerate(fx.get('operacoes', [])):
                desc = op.get('_descricao', f'Fixture {idx+1}')
                static.append(f'[E2E-Usuario-Opcoes-FX{str(idx+1).zfill(2)}] {desc}')
        except Exception:
            static.append('[E2E-Usuario-Opcoes-FX*] (template)')
    for name in static:
        tests.append({
            'file':   'e2e-usuario',
            'suite':  '[E2E-Usuario] Simulação de Usuário',
            'name':   name,
            'type':   'e2e',
            'status': 'pending',
            'dur':    0,
            'errorMessage': None,
            'traceback':    None,
            'location':     None,
        })
    return tests


@app.route('/api/tests')
def api_tests():
    """Retorna lista completa de testes escaneados dos arquivos reais (backend + frontend + ai + e2e)."""
    tests = scan_backend_tests() + scan_frontend_tests() + scan_ai_tests() + scan_e2e_tests()
    resp = jsonify({'tests': tests, 'total': len(tests)})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


def load_env_key(key: str) -> str:
    env_path = os.path.join(BASE_DIR, 'backend', '.env')
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith(key + '='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return ''


@app.route('/api/ai-hint', methods=['POST'])
def api_ai_hint():
    """
    Sugestão de IA para erros de teste.
    Tenta provedores na ordem: OpenRouter (DeepSeek) → OpenRouter (Gemini) → Gemini direto.
    """
    data = request.get_json() or {}

    context_snippet = data.get('context', '').strip()
    context_section = (
        f'\n\n**Contexto do Código (trecho relevante):**\n```python\n{context_snippet}\n```'
        if context_snippet else ''
    )

    prompt = (
        'Você é um especialista em testes automatizados Python/Pytest e Playwright. '
        'Analise este erro de teste e forneça uma dica OBJETIVA e PRÁTICA de como corrigir.\n\n'
        f'**Teste:** {data.get("suite","")} :: {data.get("name","")}\n'
        f'**Arquivo:** {data.get("file","")} ({data.get("type","")})\n'
        f'**Localização:** {data.get("location","")}\n\n'
        f'**Mensagem de Erro:**\n{data.get("errorMessage","(sem mensagem)")}\n\n'
        f'**Traceback:**\n{data.get("traceback","(sem traceback)")}'
        f'{context_section}\n\n'
        'Responda EM PORTUGUÊS, de forma concisa (máx 5 parágrafos).\n'
        'Estruture com:\n'
        '1. Causa provável\n'
        '2. Como corrigir (com exemplo de código se aplicável)\n'
        '3. Dica de prevenção (opcional)'
    )

    # ── Tentativas em ordem de preferência ────────────────────────────────────
    providers = []

    openrouter_key = load_env_key('OPENROUTER_API_KEY')
    if openrouter_key:
        providers.append({
            'name': 'OpenRouter/DeepSeek',
            'url': 'https://openrouter.ai/api/v1/chat/completions',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {openrouter_key}',
                'HTTP-Referer': 'http://localhost:8883',
                'X-Title': 'CentralClinica-TestDashboard',
            },
            'body': json.dumps({
                'model': 'deepseek/deepseek-chat',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 900,
                'temperature': 0.3,
            }).encode('utf-8'),
            'extract': lambda r: r['choices'][0]['message']['content'],
        })
        providers.append({
            'name': 'OpenRouter/Gemini',
            'url': 'https://openrouter.ai/api/v1/chat/completions',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {openrouter_key}',
                'HTTP-Referer': 'http://localhost:8883',
                'X-Title': 'CentralClinica-TestDashboard',
            },
            'body': json.dumps({
                'model': 'google/gemini-2.0-flash-001',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 900,
                'temperature': 0.3,
            }).encode('utf-8'),
            'extract': lambda r: r['choices'][0]['message']['content'],
        })

    gemini_key = load_env_key('GEMINI_API_KEY')
    if gemini_key:
        providers.append({
            'name': 'Gemini',
            'url': (
                'https://generativelanguage.googleapis.com/v1beta/models/'
                f'gemini-2.5-flash:generateContent?key={gemini_key}'
            ),
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {'temperature': 0.3, 'maxOutputTokens': 900},
            }).encode('utf-8'),
            'extract': lambda r: r['candidates'][0]['content']['parts'][0]['text'],
        })

    if not providers:
        return jsonify({'error': 'Nenhuma API key configurada em backend/.env'}), 500

    last_err = 'Sem provedores disponíveis'
    for p in providers:
        req = urllib.request.Request(p['url'], data=p['body'], headers=p['headers'], method='POST')
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                hint = p['extract'](result)
                return jsonify({'hint': hint, 'provider': p['name']})
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8')[:200]
            last_err = f'{p["name"]} HTTP {e.code}: {err_body}'
        except Exception as e:
            last_err = f'{p["name"]}: {str(e)}'

    return jsonify({'error': last_err}), 500


@app.route('/api/stream')
def api_stream():
    be_nodes        = request.args.get('be_nodes', '')
    fe_grep         = request.args.get('fe_grep', '')
    skip_be         = request.args.get('skip_be', '0') == '1'
    skip_fe         = request.args.get('skip_fe', '0') == '1'
    skip_ai         = request.args.get('skip_ai', '0') == '1'
    ai_nodes        = request.args.get('ai_nodes', '')
    skip_e2e        = request.args.get('skip_e2e', '1') == '1'  # default: skip E2E
    e2e_grep        = request.args.get('e2e_grep', '')
    e2e_headed        = request.args.get('e2e_headed',        '0') == '1'
    e2e_screenshots   = request.args.get('e2e_screenshots',   'on-error')
    e2e_cleanup_after = request.args.get('e2e_cleanup_after', '0') == '1'

    if not _run_lock.acquire(blocking=False):
        def busy():
            yield sse('log', {'type': 'warn', 'msg': '[AVISO] Execução já em andamento.'})
        return Response(stream_with_context(busy()), mimetype='text/event-stream',
                        headers={'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*'})

    def generate():
        try:
            yield from run_stream(be_nodes=be_nodes, fe_grep=fe_grep,
                                  skip_be=skip_be, skip_fe=skip_fe, skip_ai=skip_ai,
                                  ai_nodes=ai_nodes, skip_e2e=skip_e2e,
                                  e2e_grep=e2e_grep, e2e_headed=e2e_headed,
                                  e2e_screenshots=e2e_screenshots,
                                  e2e_cleanup_after=e2e_cleanup_after)
        finally:
            _run_lock.release()

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control':     'no-cache',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
        }
    )



# ─── main ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('=' * 55)
    print('📈  Controle Operações — Test Dashboard Server')
    print(f'🌐  Abra: http://localhost:{DASHBOARD_PORT}/')
    print(f'📁  Resultados em: tests/results/')
    print('=' * 55)
    app.run(host='0.0.0.0', port=DASHBOARD_PORT, debug=False, threaded=True)
