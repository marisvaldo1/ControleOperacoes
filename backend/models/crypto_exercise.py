"""Regras unificadas de exercício para operações crypto.

Para este módulo, a regra de negócio é:
  - CALL: exercício quando a cotação atual está abaixo ou igual ao strike
  - PUT:  exercício quando a cotação atual está acima ou igual ao strike

Operações abertas devem sempre refletir o estado atual com base na cotação.
Operações fechadas preservam o status persistido, quando disponível.
"""


def normalize_exercicio_status(value):
    raw = str(value or '').strip().upper()
    if raw == 'NÃO':
        raw = 'NAO'
    return raw if raw in ('SIM', 'NAO') else None


def calculate_crypto_exercicio_status(tipo, cotacao_atual, strike):
    try:
        cot = float(cotacao_atual or 0)
        strike_value = float(strike or 0)
    except (TypeError, ValueError):
        return 'NAO'

    if cot <= 0 or strike_value <= 0:
        return 'NAO'

    tipo_normalizado = str(tipo or '').strip().upper()
    if tipo_normalizado == 'CALL':
        return 'SIM' if cot <= strike_value else 'NAO'
    if tipo_normalizado == 'PUT':
        return 'SIM' if cot >= strike_value else 'NAO'
    return 'NAO'


def resolve_crypto_exercicio_status(operation):
    data = dict(operation or {})
    current_status = normalize_exercicio_status(data.get('exercicio_status_atual'))
    if current_status is None:
        current_status = calculate_crypto_exercicio_status(
            data.get('tipo'),
            data.get('cotacao_atual'),
            data.get('strike'),
        )

    persisted_status = normalize_exercicio_status(
        data.get('exercicio_status_persistido', data.get('exercicio_status'))
    )
    op_status = str(data.get('status') or 'ABERTA').strip().upper()

    if op_status == 'ABERTA':
        return current_status
    if op_status == 'EXERCIDA':
        return 'SIM'
    # Operação encerrada: nunca recalcular por cotação atual.
    # Usa exclusivamente o valor persistido no banco.
    return persisted_status or 'NAO'


def serialize_crypto_operation(operation):
    data = dict(operation or {})
    persisted_status = normalize_exercicio_status(data.get('exercicio_status'))
    current_status = calculate_crypto_exercicio_status(
        data.get('tipo'),
        data.get('cotacao_atual'),
        data.get('strike'),
    )
    display_status = resolve_crypto_exercicio_status({
        **data,
        'exercicio_status_atual': current_status,
        'exercicio_status_persistido': persisted_status,
    })

    data['exercicio_status_persistido'] = persisted_status
    data['exercicio_status_atual'] = current_status
    data['exercicio_status_exibicao'] = display_status
    data['exercicio_status'] = display_status
    return data
