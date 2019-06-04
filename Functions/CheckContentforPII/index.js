const CognitiveServicesCredentials = require('ms-rest-azure').CognitiveServicesCredentials;
const ContentModeratorAPIClient = require('azure-cognitiveservices-contentmoderator');
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('../../../skills-kit-library/skills-kit-2.0');

require('dotenv').config();
 
module.exports = async function (context, req) {

    context.log('JavaScript HTTP trigger function processed a request.');

    try{
        const filesReader = new FilesReader(context.req.rawBody);
        const skillsWriter = new SkillsWriter(filesReader.getFileContext());

        let credentials = new CognitiveServicesCredentials(process.env.contentModeratorAPIKey);
        let client = new ContentModeratorAPIClient(credentials, process.env.contentModeratorHostname);
        filesReader.getContentStream().then((fileStream) => {
            fileStream.on('data', fileData => {
                client.textModeration.screenTextWithHttpOperationResponse('text/plain',  fileData.toString(), {pII: true}).then((response) => {
                        WriteSkillCard(skillsWriter, response.body.pII);
         
                    }).catch((err) => {
                        throw err;        
                });
               
            });
        }).catch((err) => {
            throw err;        
    });
    }catch (error) {
        // Incase of error, write back an error card to UI.
        // Note: Skill developers may want to inspect the 'error' variable
        // and write back more specific errorCodes (@print SkillsErrorEnum)
        console.error(`Skill processing failed for file: ${filesReader.getFileContext().fileId} with error: ${error.message}`);
        await skillsWriter.saveErrorCard(SkillsErrorEnum.UNKNOWN);
        } finally {
        // Skills engine requires a 200 response within 10 seconds of sending an event.
            // Please see different code architecture configurations in git docs,
            // that you can apply to make sure your service always responds within time.
            context.res = { status: 200, body: 'Box event was processed by skill' }; 
            
        }
  
};

function WriteSkillCard(skillsWriter, pII)
{
      const cards = [];
      
      var pIIKeywords = [];
        if(pII)
        {
            if(pII.address && pII.address.length > 0)
            {
                pIIKeywords.push( { text: 'PII-Address' })
            }
            if(pII.email && pII.email.length > 0)
            {
                pIIKeywords.push( { text: 'PII-Email' })
            }
            if(pII.phone && pII.phone.length > 0)
            {
                pIIKeywords.push( { text: 'PII-Phone' })
            }
            if(pII.sSN && pII.sSN.length > 0)
            {
                pIIKeywords.push( { text: 'PII-SSN' })
            }

        }
        if(pIIKeywords.length > 0)
        {
            cards.push(skillsWriter.createTopicsCard(pIIKeywords));
            skillsWriter.saveDataCards(cards);
        }
}