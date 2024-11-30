import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createClientAsync } from 'soap';
import { format } from 'date-fns';

/**
 * Generates a timestamped filename with an optional extension.
 * @param {string} prefix - The prefix or base name for the file.
 * @param {number} timestamp - A UNIX timestamp for file naming.
 * @param {string} [extension='xml'] - The desired file extension.
 * @returns {string} - The generated filename.
 */
const generateFilename = (prefix, timestamp, extension = 'xml') => {
  const fileNameTimestamp = format(new Date(timestamp), 'yyyyMMddHHmm');
  const suffix = /\.[a-z0-9]+$/i.test(prefix) ? '' : `.${extension}`;
  return `${fileNameTimestamp}-${prefix}${suffix}`;
};

/**
 * Writes content to a file and logs the result.
 * @param {string} content - The content to write.
 * @param {string} prefix - The filename prefix.
 * @param {number} timestamp - A UNIX timestamp for file naming.
 * @param {string} [extension='xml'] - The file extension.
 */
const saveXmlFile = (content, prefix, timestamp, extension = 'xml') => {
  const fileName = generateFilename(prefix, timestamp, extension);
  writeFileSync(fileName, content, 'utf-8');
  console.log(`Archivo guardado: ${fileName}`);
};

/**
 * Generates an XML login ticket request.
 * @param {string} serviceId - The service ID.
 * @param {number} timestamp - A UNIX timestamp.
 * @returns {string} - The generated XML string.
 */
const generateLoginTicketRequestXml = (serviceId, timestamp) => {
  const generationTime = format(new Date(timestamp - 10 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss");
  const expirationTime = format(new Date(timestamp + 10 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss");
  const uniqueId = format(new Date(timestamp), 'yyMMddHHmm');

  return `
    <loginTicketRequest>
        <header>
            <uniqueId>${uniqueId}</uniqueId>
            <generationTime>${generationTime}</generationTime>
            <expirationTime>${expirationTime}</expirationTime>
        </header>
        <service>${serviceId}</service>
    </loginTicketRequest>
  `.trim();
};

/**
 * Signs an XML file using OpenSSL and returns the signed filename.
 * @param {string} xmlFilename - The XML filename to sign.
 * @param {string} cert - The path to the certificate.
 * @param {string} privateKey - The path to the private key.
 * @returns {string} - The signed file's name.
 */
const signCms = (xmlFilename, cert, privateKey) => {
  try {
    const signedFileDER = `${xmlFilename}.cms.der`;
    execSync(`openssl cms -sign -in ${xmlFilename} -signer ${cert} -inkey ${privateKey} -nodetach -outform der -out ${signedFileDER}`);
    execSync(`openssl base64 -in ${signedFileDER} -out ${xmlFilename}.cms`);
    return `${xmlFilename}.cms`;
  } catch (error) {
    throw new Error(`Error al firmar el CMS: ${error.message}`);
  }
};

/**
 * Calls the WSAA service using SOAP.
 * @param {string} wsdlUrl - The WSDL URL.
 * @param {string} cmsFile - The CMS file path.
 * @returns {object} - The SOAP response.
 */
const callWsaa = async (wsdlUrl, cmsFile) => {
  const cmsContent = readFileSync(cmsFile, 'utf-8');
  const client = await createClientAsync(wsdlUrl);
  const [response] = await client.loginCmsAsync({ in0: cmsContent });
  return response;
};

/**
 * Main function to execute the WSAA flow.
 */
const main = async () => {
  try {
    const {
      CERT_PATH: cert,
      PRIVATE_KEY_PATH: privateKey,
      SERVICE_ID: serviceId,
      WSDL_URL: wsdlUrl,
      XML_FILE: xmlPrefix,
    } = process.env;

    if (!cert || !privateKey || !serviceId || !wsdlUrl || !xmlPrefix) {
      throw new Error('Faltan variables de entorno necesarias.');
    }

    const timestamp = Date.now();

    // Step 1: Generate the login ticket request XML
    const xmlContent = generateLoginTicketRequestXml(serviceId, timestamp);
    saveXmlFile(xmlContent, xmlPrefix, timestamp);

    // Step 2: Sign the XML
    const xmlFilename = generateFilename(xmlPrefix, timestamp);
    const cmsFile = signCms(xmlFilename, cert, privateKey);

    // Step 3: Call WSAA and save the response
    const response = await callWsaa(wsdlUrl, cmsFile);
    saveXmlFile(response.loginCmsReturn, 'loginTicketResponse', timestamp);
    console.log('Respuesta WSAA:', response);
  } catch (error) {
    console.error('Error:', error.message);
  }
};

main();
