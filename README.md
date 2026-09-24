# ShortLink

Projeto acadêmico de um encurtador de URLs com arquitetura distribuída.

## Estrutura inicial

- `frontend/`: interface web responsiva do encurtador.
- API e serviços distribuídos: em desenvolvimento pela equipe.

## Executar o frontend

Abra `frontend/index.html` diretamente no navegador ou sirva a pasta com um servidor estático.

O template funciona em modo demonstrativo. Para conectar a API, edite a constante `API_ENDPOINT` no final de `frontend/index.html`.

## Integração esperada

O formulário envia uma requisição `POST` em JSON no formato:

```json
{
  "url": "https://exemplo.com/pagina"
}
```

A resposta pode utilizar `shortUrl`, `short_url` ou `url` para informar o link encurtado.
