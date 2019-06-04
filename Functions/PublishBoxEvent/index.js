require('dotenv').config();
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('../../skills-kit-library/skills-kit-2.0');
var EventGridClient = require("azure-eventgrid");
var msRestAzure = require('ms-rest-azure');
var uuid = require('uuid').v4;
 module.exports = async (context)  =>{
   
    try {
        const filesReader = new FilesReader(context.req.rawBody);
    
        const skillsWriter = new SkillsWriter(filesReader.getFileContext());
        await PosttoEventGrid(filesReader, context.req.rawBody);

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

function PosttoEventGrid(filesReader, reqBody)
{

    let topicCreds = new msRestAzure.TopicCredentials(process.env.boxTriggerEventTopicKey);
    let EGClient = new EventGridClient(topicCreds);
    let topicHostName = process.env.publishBoxEventGridEndPoint;
    let events = [
    {
        id: filesReader.fileId,
        subject: 'Box.ContentCreated', //should use some other subject
        dataVersion: '1.0',
        eventType: filesReader.fileType,
        eventTime: filesReader.eventTime,
        data: reqBody
    }
    ];
    return EGClient.publishEvents(topicHostName, events).then((result) => {
    return Promise.resolve(console.log('Published events successfully.'));
    }).catch((err) => {
    console.log('An error ocurred');
    console.dir(err, {depth: null, colors: true});
    });
}
