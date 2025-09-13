// expose Light Rail stop → station_id map
window.TimoETA.LR_STOPS = {
  'Tuen Mun Ferry Pier':1,'Melody Garden':10,'Butterfly':15,
  'Light Rail Depot':20,'Lung Mun':30,'Tsing Shan Tsuen':40,
  'Tsing Wun':50,'Kin On':60,'Ho Tin':70,'Choy Yee Bridge':75,
  'Affluence':80,'Tuen Mun Hospital':90,'Siu Hong':100,'Kei Lun':110,
  'Ching Chung':120,'Kin Sang':130,'Tin King':140,'Leung King':150,
  'San Wai':160,'Shek Pai':170,'Shan King (North)':180,
  'Shan King (South)':190,'Ming Kum':200,'Tai Hing (North)':212,
  'Tai Hing (South)':220,'Ngan Wai':230,'Siu Hei':240,
  'Tuen Mun Swimming Pool':250,'Goodview Garden':260,'Siu Lun':265,
  'On Ting':270,'Yau Oi':275,'Town Centre':280,'Tuen Mun':295,
  'Pui To':300,'Hoh Fuk Tong':310,'San Hui':320,'Prime View':330,
  'Fung Tei':340,'Lam Tei':350,'Nai Wai':360,'Chung Uk Tsuen':370,
  'Hung Shui Kiu':380,'Tong Fong Tsuen':390,'Ping Shan':400,
  'Hang Mei Tsuen':425,'Tin Shui Wai':430,'Tin Tsz':435,'Tin Yiu':445,
  'Locwood':448,'Tin Wu':450,'Ginza':455,'Tin Shui':460,'Chung Fu':468,
  'Tin Fu':480,'Chestwood':490,'Tin Wing':500,'Tin Yuet':510,'Tin Sau':520,
  'Wetland Park':530,'Tin Heng':540,'Tin Yat':550,'Shui Pin Wai':560,
  'Fung Nin Road':570,'Hong Lok Road':580,'Tai Tong Road':590,
  'Yuen Long':600,'Sam Shing':920
};
window.TimoETA.LR_NAME_TO_ID = Object.entries(window.TimoETA.LR_STOPS)
  .reduce((m,[n,i]) => {
    m[n.toLowerCase()] = i;
    return m;
  }, {});