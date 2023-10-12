import { readdir, readFile, writeFile } from "fs";
import { extname, join } from "path";
import { create } from "exif-parser";
import proj4 from "proj4";
import egm96 from "egm96-universal";

export default class GpsDataProcessor {
  constructor(folderPath, txtFilePath) {
    this.folderPath = folderPath || "./Folder";
    this.txtFilePath = txtFilePath || "gps_data.txt";
    this.tableData = [];
  }

  processGpsData() {
    proj4.defs(
      "EPSG:32638",
      "+proj=utm +zone=38 +datum=WGS84 +units=m +no_defs"
    );

    readdir(this.folderPath, (err, files) => {
      if (err) {
        console.error("Error reading folder:", err);
        return;
      }

      const jpegFiles = files.filter(
        (file) => extname(file).toLowerCase() === ".jpg"
      );

      jpegFiles.forEach((jpegFile) => {
        const filePath = join(this.folderPath, jpegFile);

        readFile(filePath, (err, data) => {
          if (err) {
            console.error("Error reading file:", err);
            return;
          }

          const parser = create(data);
          const exifData = parser.parse();

          const latitude = exifData.tags.GPSLatitude;
          const longitude = exifData.tags.GPSLongitude;

          const utmCoords = proj4("EPSG:32638", [longitude, latitude]);

          const geoidHeight = egm96.ellipsoidToEgm96(
            utmCoords[0],
            utmCoords[1],
            exifData.tags.GPSAltitude
          );

          this.tableData.push({
            FileName: jpegFile,
            Latitude: utmCoords[1],
            Longitude: utmCoords[0],
            Altitude: exifData.tags.GPSAltitude.toFixed(3),
            GeoidHeight: geoidHeight.toFixed(3),
          });

          if (this.tableData.length === jpegFiles.length) {
            this.tableData.sort((a, b) => {
              const fileNameA = a.FileName.toLowerCase();
              const fileNameB = b.FileName.toLowerCase();
              if (fileNameA < fileNameB) {
                return -1;
              } else if (fileNameA > fileNameB) {
                return 1;
              } else {
                return 0;
              }
            });

            this.generateTxtOutput();
          }
        });
      });
    });
  }

  generateTxtOutput() {
    let txtContent = "";

    txtContent += "FileName\tLongitude\tLatitude\tAltitude\tGeoidHeight\n";

    this.tableData.forEach((item) => {
      txtContent += `${item.FileName}\t${item.Longitude}\t${item.Latitude}\t${item.Altitude}\t${item.GeoidHeight}\n`;
    });

    writeFile(this.txtFilePath, txtContent, "utf-8", (err) => {
      if (err) {
        console.error("Error writing text file:", err);
        return;
      }
      console.log(`Text file has been written to ${this.txtFilePath}`);
    });
  }
}
