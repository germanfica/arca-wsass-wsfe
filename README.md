# ARCA WSASS

WSASS (Web Service Authorization and Security System) es una aplicación web que permite a los programadores gestionar certificados digitales y configurar autorizaciones de acceso a los webservices SOAP del entorno de testing de ARCA (Agencia de Recaudación y Control Aduanero) de Argentina.

Básicamente, el WSASS genera certificados digitales para testing. Dichos certificados digitales no son de aplicación para el ambiente de producción.

## Set enviroment variables

Windows example:

```bash
# Establecer las variables de entorno
$env:CERT_PATH = "certs/test.crt"
$env:PRIVATE_KEY_PATH = "certs/MiClavePrivada.key"
$env:SERVICE_ID = "wsfe"
$env:XML_FILE = "LoginTicketRequest.xml"
$env:WSDL_URL = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL"
```