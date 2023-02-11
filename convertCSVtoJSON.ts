
//Convert a CSV file to JSON object
export const convertCSVtoJSON = async (
  path: string,
  //defaultPK will be lineNumber
  primaryKey?: string,
) => {
  /* Notes for handling double quotes:
    Adjacent double quotes are escape for one double quote
    Whenever an isolated double quote appear, there must be another double quote to wrap the content
    There could be line breaks wrapped between double quotes
    Content between two double quotes should be treated as one string connecting its two ends
    Line breaks between two double quotes should be added as \r\n
    Basically there are three cases to deal with when encountering double quotes:
     Case 1: There's an ajacent quote that makes an escape
     Case 2: The starting quote and the closing quote are in the same line
     Case 3: The closing quote is in succeeding lines
    Edge case: The closing quote could have no comma connected if it is the last character in the line
    */
  var dirArray = process.argv[1];
  var filePath = dirArray.substring(0, dirArray.lastIndexOf('/') + 1) + path;
  const fileStream = fs.createReadStream(filePath);
  const rl = readLine.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  return new Promise((resolve, reject) => {
    try {
      var dataset = <any>{}, //Object to hold the body data in lines
        keys: Array<string> = [], //Header fields
        lineNumber = 0, //Counter to differentiate header and body; also serves as default primary key
        brokenLine = '', //Store broken piece from previous line
        prevValues: Array<string> = []; //Hold values from previous line
      rl.on('line', (line) => {
        // console.log(lineNumber);
        //Case 1: Check all escapes and convert it to symbol
        if (line.includes('""')) {
          line = line.replace(/\"\"/g, 'markOfEscapeSign');
        }

        //deal with header
        if (lineNumber == 0) {
          //Disallow line break in headers
          if (line.includes('"')) {
            reject(new Error('Invalid header field'));
          }
          line.split(',').forEach((field) => {
            field = field.replace(/markOfEscapeSign/g, '"');
            //Identify empty field names if neccessary
            // if(field==""){
            //     field="Empty";
            // }
            keys.push(field);
          });
          //Check if primary key is correct
          if (primaryKey && !keys.includes(primaryKey)) {
            reject(new Error('Invalid primary key'));
          }
        } else {
          //deal with table body
          let values: Array<string> = []; // Hold cell values of current line
          // Case 3: Inherits broken piece from previous line
          if (brokenLine != '') {
            let closingQuote = line.indexOf('"');
            if (closingQuote != -1) {
              //Found the closing double quote
              let quotedString =
                brokenLine + '\n' + line.substring(0, closingQuote);
              values.push(...prevValues, quotedString);
              brokenLine = '';
              prevValues = [];
              line = line.substring(closingQuote + 2);
            } else {
              //closing quote could be in next line, continue to pass the broken to the next line
              brokenLine = brokenLine + '\n' + line;
            }
            //enter case 2
          }
          //Case 2: Lines without inherited broken piece from the beginning
          if (brokenLine == '') {
            let obj = <any>{},
              pk = lineNumber.toString(); //Use lineNumber as default primary key
            //deal with double quotes
            while (line.includes('"')) {
              let firstQuote = line.indexOf('"');
              let secondQuote = line.indexOf('"', firstQuote + 1);
              if (secondQuote == -1) {
                //the closing quote is in the next line
                brokenLine = line.substring(firstQuote + 1);
                prevValues = line.substring(0, firstQuote).split(',');
                lineNumber--;
                break; //Will go to next line, enter Case 3:
              } else {
                //Found the closing quote
                //save the fields and quoted content
                let quotedString = line.substring(firstQuote + 1, secondQuote);
                values.push(
                  ...line.substring(0, firstQuote - 1).split(','),
                  quotedString,
                );
                if (line.length - 1 != secondQuote) {
                  //continue the loop with rest of the string
                  line = line.substring(secondQuote + 2);
                }
              }
            }
            //No more double quotes
            if (brokenLine == '') {
              values.push(...line.split(','));
              values.forEach((value, index) => {
                value = value.replace(/markOfEscapeSign/g, '"');
                let key = keys[index];
                if (primaryKey && key == primaryKey) {
                  pk = value;
                }
                obj[key] = value;
              });
              dataset[pk] = obj;
            }
          }
        }

        lineNumber++;
      });
      rl.on('close', () => {
        let file = path.split('/').pop()?.split('.')[0];
        let result = {
          [`${file}`]: dataset,
        };
        resolve(JSON.stringify(result));
        // console.log(Object.entries(dataset).length);
        // resolve(dataset);
        // resolve(keys);
        // resolve(lineNumber);
      });
    } catch (error) {
      reject(error);
    }
  });
};


convertCSVtoJSON(process.argv[2])
  .then((res) => {
    if (typeof res == 'string') {
      console.log(JSON.parse(res));
    }
    // console.log(res);
  })
  .catch((err) => {
    console.log(err);
  });
