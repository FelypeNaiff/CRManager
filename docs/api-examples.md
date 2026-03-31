# Exemplos de Requisições (CRManager)

## Login (JWT + tenant)
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"5511999999999","otp":"1234","lojaId":"11111111-1111-1111-1111-111111111111","role":"OWNER"}'
```

## Criar cliente no CRM
```bash
curl -X POST http://localhost:4000/api/crm/customers \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'x-loja-id: 11111111-1111-1111-1111-111111111111' \
  -H 'Content-Type: application/json' \
  -d '{"loja_id":"11111111-1111-1111-1111-111111111111","name":"Maria","phone":"5511912345678","segment":"VIP"}'
```

## Registrar filho (CRM Infantil)
```bash
curl -X POST http://localhost:4000/api/crm/kids \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'x-loja-id: 11111111-1111-1111-1111-111111111111' \
  -H 'Content-Type: application/json' \
  -d '{"loja_id":"11111111-1111-1111-1111-111111111111","customer_phone":"5511912345678","name":"Lucas","birth_date":"2020-03-15"}'
```

## Webhook WhatsApp
```bash
curl -X POST http://localhost:4000/webhooks/whatsapp \
  -H 'Content-Type: application/json' \
  -d '{"lojaId":"11111111-1111-1111-1111-111111111111","trigger":"MESSAGE","payload":{"phone":"5511912345678","text":"Oi"}}'
```
