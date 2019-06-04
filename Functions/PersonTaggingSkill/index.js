const CognitiveServicesCredentials = require('ms-rest-azure').CognitiveServicesCredentials;
const vision = require('azure-cognitiveservices-vision');
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('../../../skills-kit-library/skills-kit-2.0');
const request = require('request');
require('dotenv').config();
var storage = require('azure-storage');
var Jimp = require('jimp');
 
module.exports = async function (context, req) {

    context.log('JavaScript HTTP trigger function processed a request.');
    const filesReader = new FilesReader(context.req.rawBody);
    const skillsWriter = new SkillsWriter(filesReader.getFileContext());

    let credentials = new CognitiveServicesCredentials(process.env.computerVisionAPIKey);
    let client = new vision.ComputerVisionAPIClient(credentials, process.env.computerVisionHostname);
 
    // Replace <Subscription Key> with your valid subscription key.
    const subscriptionKey = process.env.computerVisionAPIKey;

    // You must use the same location in your REST call as you used to get your
    // subscription keys. For example, if you got your subscription keys from
    // westus, replace "westcentralus" in the URL below with "westus".
    const uriBase = process.env.computerVisionHostname + "/vision/v2.0/analyze";

    const imageUrl = filesReader.getFileContext().fileDownloadURL;

    var visualFeatures = process.env.computerVisionVisualFeatures.split(',');
    var details = process.env.computerVisionDetails.split(',');
    var language = process.env.computerVisionLanguage;
    // Request parameters.
    const params = {
        'visualFeatures': process.env.computerVisionVisualFeatures,
        'details': process.env.computerVisionDetails,
        'language': process.env.computerVisionLanguage
    };

    const options = {
        uri: uriBase,
        qs: params,
        body: '{"url": ' + '"' + imageUrl + '"}',
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key' : subscriptionKey
        }
    };
    try{
     
        ProcessImageFile(filesReader.fileDownloadURL, filesReader.fileFormat, filesReader.fileId, skillsWriter)
           
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




async function ProcessImageFile(fileDownloadUrl, fileType, fileId, skillsWriter){
    var keywords = [];
    const cards = [];
    const mockListOfDiscoveredFaceWithPublicImageURI = [
        {
            image_url: "https://seeklogo.com/images/B/box-logo-646A3D8C91-seeklogo.com.png",
            text: "Image hover/placeholder text if image doesn't load"
        }
    ];
    
    let imageResponse = await AnalyzeImage(fileDownloadUrl);
    createThumbNails(fileDownloadUrl, fileType, imageResponse, fileId).then((thumbNails) => {
        
        const cards = [];
        let celebrities = imageResponse.categories[0].detail.celebrities;
        celebrities.forEach(function(celebrityData) {
         keywords.push({ text: celebrityData.name});
        });
 
        imageResponse.description.tags.forEach( function(keyword) { 
            keywords.push({ text: keyword});
       } );
     
       cards.push(skillsWriter.createTopicsCard(keywords));
            skillsWriter.saveDataCards(cards);
     
    
      });
    }



function WriteSkillsCards(skillsWriter, thumbNails, keywords){
   
    cards.push(skillsWriter.createFacesCard(thumbNails, null, 'Icons')); 
    
       
    
}
function AnalyzeImage(fileDownloadUrl){
   
    const subscriptionKey = process.env.computerVisionAPIKey;
    const uriBase = process.env.computerVisionHostname + "/vision/v2.0/analyze";
    const imageUrl = fileDownloadUrl;

    // Request parameters.
    const params = {
        'visualFeatures': process.env.computerVisionVisualFeatures,
        'details': process.env.computerVisionDetails,
        'language': process.env.computerVisionLanguage
    };

    const options = {
        uri: uriBase,
        qs: params,
        body: '{"url": ' + '"' + imageUrl + '"}',
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key' : subscriptionKey
        }
     };
     return new Promise(resolve => {
        request.post(options, (error, response, body) => {
            if (error) {
              console.log('Error: ', error);
              return;
            }
            
            resolve(JSON.parse(body));
           
          });
      });
  
}

 async function createThumbNails(fileDownloadUrl, fileType, imageResponse, fileId){
    var thumbNails = [];
    var promises = [];
    return new Promise(resolve => {
        if(imageResponse && imageResponse.categories[0].detail.celebrities.length > 0){
            let celebrities = imageResponse.categories[0].detail.celebrities;
            celebrities.forEach(function(celebrityData) {
                fileName = fileId + celebrityData.name + "." + fileType;
                promises.push(
                   
                    CreateThumbNail(celebrityData, fileDownloadUrl, fileName).then((thumbnail) => {
                      thumbNails.push(thumbnail);
                    })
                )
            });
        }
        Promise.all(promises).then(() => {
            resolve(thumbNails);
        })
    })
       
   
    
}
    
   
    
    function CreateThumbNail(celebrityData, fileDownloadUrl, fileName){
        var blobService = storage.createBlobService();
        return new Promise(resolve => {
            request({uri: fileDownloadUrl, encoding: null }, (err, resp, buffer) => {
                Jimp.read(buffer)
                    .then(image => {
                        image
                        .crop( celebrityData.faceRectangle.left, celebrityData.faceRectangle.top, celebrityData.faceRectangle.width, celebrityData.faceRectangle.height )
                          .write(fileName, (err, resp, buffer) =>{
                        blobService.createBlockBlobFromLocalFile(process.env.personTaggingStorageContainer, fileName, fileName, function(error, result, response) {
                            resolve({
                                image_url: process.env.personTaggingStorageEndpoint + "/" + process.env.personTaggingStorageContainer + "/" + fileName,
                                text: celebrityData.name
                            });
                            
                          });
                    });
                        
                    })
                    .catch(err => {
                        // Handle an exception.
                        console.error(err);
                    });
                })
            })
    }

