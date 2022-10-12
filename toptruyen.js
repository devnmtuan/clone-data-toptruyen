const fsExtra = require("fs-extra");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
require("dotenv").config();
//config simple store bizfly
const s3 = require("./config/config-simple-object.js");
const fs = require("fs");
const path = require("path");
const db = require("./config/config-firebase.js");
const {
  collection,
  query,
  where,
  doc,
  addDoc,
  getDocs,
  updateDoc,
} = require("firebase/firestore");

const domain = `https://toptruyen.net`;

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

const topTruyen = async () => {
  const q = query(
    collection(db, "comics"),
    where("source", "==", "toptruyen"),
    where("isPull", "==", true)
  );

  let listComic = [];
  const snapshot = await getDocs(q);
  snapshot.forEach((doc) => {
    listComic.push({
      comicId: doc.id,
      nameKey: doc.data().nameKey,
      pagePath: doc.data().pagePath,
      qtyChapter: doc.data().qtyChapter,
      comicName: doc.data().comicName,
    });
  });

  delay(1000);
  console.log(listComic);
  for (const e of listComic) {
    await CloneDataFunction(e);
  }
};

const CloneDataFunction = async (pageObject) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox"],
    executablePath: '/usr/bin/google-chrome',
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(domain + pageObject.pagePath, {
    waitUntil: "domcontentloaded",
  });
  //console.log(page.content);

  const chapterQtys = await page.$$eval(
    ".list-chapter > nav > ul .row",
    (chapters) => {
      return chapters.length;
    }
  );
  // console.log(chapterQtys);

  let rowChapters = [];
  for (let i = 2; i <= chapterQtys; i++) {
    const chapter = ([nameChapter, urlChapter] = await Promise.all([
      await page.$eval(
        `.list-chapter nav ul .row:nth-child(${i}) .chapters a`,
        (e) => e.innerText
      ),
      await page.$eval(
        `.list-chapter nav ul .row:nth-child(${i}) .chapters a`,
        (e) => e.href
      ),
    ]));
    rowChapters.push(chapter);
  }
  console.log('rowChapters',rowChapters);
  console.log(
    pageObject.comicName,
    rowChapters.length,
    rowChapters.length - pageObject.qtyChapter
  );

  if (rowChapters.length > pageObject.qtyChapter) {
    let chapterOrder = pageObject.qtyChapter;
    for (let q = rowChapters.length - pageObject.qtyChapter - 1; q >= 0; q--) {
      try {
        console.log('qqqqq',q)
        if (q == rowChapters.length - pageObject.qtyChapter - 1) {
          const docRef = doc(db, "comics", pageObject.comicId);
          updateDoc(docRef, {
            oldQtyChapter: pageObject.qtyChapter,
          });
        }
        await page.setDefaultNavigationTimeout(0);
        if (rowChapters[q][1] == undefined) {
          console.log("Not found pagePath");
          return;
        }
        await page.goto(rowChapters[q][1], { waitUntil: "networkidle2" });
        await delay(500);
        await page.evaluate(() => {
          const checkScrollUp = document.querySelector(".fa-angle-up");
          if (!!checkScrollUp) {
            checkScrollUp.style.display = "none";
          }
          const checkNav = document.querySelector(".chapter-nav");
          if (!!checkNav) {
            checkNav.style.display = "none";
          }
          const checkAds = document.querySelector(".advertisement");
          if (!!checkAds) {
            checkAds.style.display = "none";
          }
        });

        const imgUrls = await page.$$eval("div[id^='page']", (images) => {
          return images.length;
        });
        console.log("imgUrls", imgUrls);
        let list = [];
        for (let i = 0; i < imgUrls; i++) {
          const image = await page.$(`.list-image-detail #page_${i + 1} img`);
          if (image != null) {
            await delay(500);
            const bounding_box = await image.boundingBox();
            list[i] = { imgUrls: image, bounding_box: bounding_box };
          }
        }

        list = list.filter((image) => image != null);
        console.log("list", list.length);

        fsExtra.emptyDirSync(`${__dirname}/chapter`);

        console.log("q", q);
        console.log(rowChapters[q][0]);

        for (let j = 0; j < list.length; j++) {
          if (list[j] != null) {
            await delay(500);
            console.log("text x", j);
            await page.evaluate(() => {
              const checkAds = document.querySelector("#adbro-bottom");
              if (!!checkAds) {
                checkAds.style.display = "none";
              }
            });
            await list[j].imgUrls.screenshot({
              path: `${__dirname}/chapter/image-${j + 1}.jpg`,
              clip: {
                x: list[j].bounding_box.x,
                y: list[j].bounding_box.y,
                width: list[j].bounding_box.width,
                height: list[j].bounding_box.height,
              },
            });
          }
        }

        // const length = fs.readdirSync(`${__dirname}/chapter`).length;
        // if (length != list.length - 2) {
        //   const error =
        //     "Quantity file created not match with quantity image in page";
        //   await errorsDoc(pageObject.comicName, rowChapters[q][0], error);
        //   console.log(error);
        //   return;
        // }

        let listUrlImageStorage = [];
        await (async () => {
          for (let j = 1; j <= list.length; j++) {
            const file = `${__dirname}/chapter/image-${j}.jpg`;
            const uploadParams = {
              Bucket: `x-comic-chapter-images/${pageObject.nameKey}/${rowChapters[q][0]}`,
              Key: "",
              Body: "",
            };
            const fileStream = await fs.createReadStream(file);
            await fileStream.on("error", function (err) {
              console.log("File Error", err);
            });
            uploadParams.Body = fileStream;
            uploadParams.Key = await path.basename(file);
            uploadParams.ContentType = "image/jpeg";
            uploadParams.ACL = "public-read";
            await delay(300);
            await s3.upload(uploadParams, (err, data) => {
              if (err) {
                console.log("Error", err);
              }
              if (data) {
                console.log("Upload Success", data.Location);
                let location = "";
                if (/^\s/.test(data.Location) == true) {
                  location = data.Location.replace(data.Location[0], "");
                } else {
                  location = data.Location;
                }
                listUrlImageStorage[j - 1] = location;
              }
            });
          }
        })();

        let countTimes = 0;
        let checkRecurFinish = false;
        let insertChapterFirebase = async () => {
          if (listUrlImageStorage.length == list.length) {
            listUrlImageStorage = listUrlImageStorage.filter((e) => e != null);
            data = {
              chapterName: rowChapters[q][0],
              comicId: pageObject.comicId,
              createdAt: new Date(),
              loveQty: Math.floor(Math.random() * 100),
              viewQty: Math.floor(Math.random() * 1000),
              order: chapterOrder,
              urlChapterImages: listUrlImageStorage,
            };
            console.log("list " + JSON.stringify(listUrlImageStorage));

            addDoc(collection(db, "chapters"), { ...data });

            const docRef = doc(db, "comics", pageObject.comicId);
            updateDoc(docRef, {
              qtyChapter: chapterOrder,
              updatedAt: new Date(),
            });
            if (q == 0) {
              const weekday = ["cn", "t2", "t3", "t4", "t5", "t6", "t7"];
              const day = weekday[new Date().getDay()];
              const docRef = doc(db, "comics", pageObject.comicId);
              updateDoc(docRef, {
                daily: day,
              });
              logsDoc(
                pageObject.comicName,
                rowChapters.length - pageObject.qtyChapter
              );
            }
          } else {
            if (countTimes >= 10) {
              return;
            }
            setTimeout(() => insertChapterFirebase(), 2000);
            countTimes++;
          }
        };
        await insertChapterFirebase();
        chapterOrder++;
      } catch (error) {
        await errorsDoc(pageObject.comicName, rowChapters[q][0], error.message);
        console.log(error.message);
        return;
      }
    }
  }

  browser.close();
};
const errorsDoc = async (comicName, chapter, error) => {
  await addDoc(collection(db, "errors"), {
    position: `toptruyen - ${comicName} - ${chapter}`,
    message: error,
    createdAt: new Date(),
  });
};
const logsDoc = async (comicName, qtyChapter) => {
  addDoc(collection(db, "logs"), {
    status: "success",
    message: `toptruyen - ${comicName} - upload success ${qtyChapter}`,
    createdAt: new Date(),
  });
};
// topTruyen();
 module.exports = topTruyen;

// CloneDataFunction(listPageDetail);
