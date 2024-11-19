import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createClientAsync } from 'soap';
import { format } from 'date-fns';

const generateXml = (serviceId) => {
  const now = new Date();
  const generationTime = format(new Date(now.getTime() - 10 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss");
  const expirationTime = format(new Date(now.getTime() + 10 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss");
  const uniqueId = format(now, 'yyMMddHHmm');

  const xml = `
        <loginTicketRequest>
            <header>
                <uniqueId>${uniqueId}</uniqueId>
                <generationTime>${generationTime}</generationTime>
                <expirationTime>${expirationTime}</expirationTime>
            </header>
            <service>${serviceId}</service>
        </loginTicketRequest>
    `;

  return xml.trim();
};

const signCms = (xmlFile, cert, privateKey) => {
  const signedFile = `${xmlFile}.cms`;
  const signedFileDER = `${xmlFile}.cms.der`;

  execSync(`openssl cms -sign -in ${xmlFile} -signer ${cert} -inkey ${privateKey} -nodetach -outform der -out ${signedFileDER}`);
  execSync(`openssl base64 -in ${signedFileDER} -out ${signedFile}`);

  return signedFile;
};

const callWsaa = async (wsdlUrl, cmsFile) => {
  const cmsContent = readFileSync(cmsFile, 'utf-8');

  const client = await createClientAsync(wsdlUrl);
  const response = await client.loginCmsAsync({ in0: cmsContent });

  return response[0];
};

const main = async () => {
  try {
    const cert = process.env['CERT_PATH'];
    const privateKey = process.env['PRIVATE_KEY_PATH'];
    const serviceId = process.env['SERVICE_ID'];
    const xmlFile = process.env['XML_FILE'];
    const wsdlUrl = process.env['WSDL_URL'];

    // Paso 1: Generar el XML
    const xmlContent = generateXml(serviceId);
    writeFileSync(xmlFile, xmlContent);

    // Paso 2: Firmar el XML
    const cmsFile = signCms(xmlFile, cert, privateKey);

    // Paso 3: Invocar al WSAA
    const response = await callWsaa(wsdlUrl, cmsFile);
    console.log('Respuesta WSAA:', response);
  } catch (error) {
    console.error('Error:', error.message);
  }
};

main();
