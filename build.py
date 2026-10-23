#!/usr/bin/env python3
"""Monta o index.html único (padrão dos painéis Login Serv) a partir de src/."""
import json, datetime, pathlib
R = pathlib.Path(__file__).parent; S = R / 'src'
logo = (S / 'logo.datauri').read_text().strip()
build = datetime.datetime.now().strftime('%Y-%m-%d-%H%M')
css = (S / 'base.css').read_text(encoding='utf8') + (S / 'extra.css').read_text(encoding='utf8')
body = (S / 'body.html').read_text(encoding='utf8').replace('{{LOGO}}', logo).replace('{{BUILD}}', build)
js = '\n'.join((S / f).read_text(encoding='utf8') for f in ['core.js', 'views.js', 'forms.js', 'print.js', 'caepi.js', 'compras.js', 'clientes.js', 'importar_produtos.js', 'importar_compras.js'])
js = "var LOGO_SRC = document.querySelector('.brand-logo-img') ? '' : '';\n" + js
html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Painel Estoque — Login Serv</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<style>{css}</style>
</head>
<body>
{body}
<script>
{js}
LOGO_SRC = document.querySelector('.brand-logo-img').getAttribute('src');
</script>
</body>
</html>
'''
(R / 'index.html').write_text(html, encoding='utf8')
print('index.html', len(html), 'bytes, build', build)
