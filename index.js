import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createClientAsync } from 'soap';
import { format } from 'date-fns';

const generateFilename = (prefix, timestamp, extension = 'xml') => {
  const fileNameTimestamp = format(new Date(timestamp), 'yyyyMMddHHmm');
  return `${fileNameTimestamp}-${prefix}.${extension}`;
};

const saveXmlFile = (content, prefix, timestamp, extension = 'xml') => {
  const fileName = generateFilename(prefix, timestamp, extension);
  writeFileSync(fileName, content, 'utf-8');
  console.log(`Archivo guardado: ${fileName}`);
};

const generateXml = (serviceId, timestamp) => {
  const now = new Date();
  const generationTime = format(new Date(timestamp - 10 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss");
  const expirationTime = format(new Date(timestamp + 10 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss");
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

const signCms = (xmlFilename, cert, privateKey) => {
  const signedFile = `${xmlFilename}.cms`;
  const signedFileDER = `${xmlFilename}.cms.der`;

  execSync(`openssl cms -sign -in ${xmlFilename} -signer ${cert} -inkey ${privateKey} -nodetach -outform der -out ${signedFileDER}`);
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
    const wsdlUrl = process.env['WSDL_URL'];
    const xmlPrefix = process.env['XML_FILE'];
    const timestamp = Date.now();

    // Paso 1: Generar el XML
    const xmlContent = generateXml(serviceId, timestamp);
    saveXmlFile(xmlContent, xmlPrefix, timestamp);

    // Paso 2: Firmar el XML
    const xmlFilename = generateFilename(xmlPrefix, timestamp);
    const cmsFile = signCms(xmlFilename, cert, privateKey);

    // Paso 3: Invocar al WSAA
    const response = await callWsaa(wsdlUrl, cmsFile);

    // Guardar la respuesta
    saveXmlFile(response.loginCmsReturn, 'loginTicketResponse', timestamp);
    console.log('Respuesta WSAA:', response);
  } catch (error) {
    console.error('Error:', error.message);
  }
};

main();
