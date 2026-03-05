export const GOOGLE_SEARCH_KEYWORDS = [
  'taller de motos',
  'refaccionaria de motos',
  'refacciones para motocicleta',
  'taller mecánico de motocicletas',
  'moto repuestos',
  'accesorios y refacciones para moto',
];

export const DENUE_KEYWORDS = [
  'motocicleta',
  'moto',
  'motorcycle',
];

export const MEXICO_STATES = [
  { code: '01', name: 'Aguascalientes' },
  { code: '02', name: 'Baja California' },
  { code: '03', name: 'Baja California Sur' },
  { code: '04', name: 'Campeche' },
  { code: '05', name: 'Coahuila' },
  { code: '06', name: 'Colima' },
  { code: '07', name: 'Chiapas' },
  { code: '08', name: 'Chihuahua' },
  { code: '09', name: 'Ciudad de México' },
  { code: '10', name: 'Durango' },
  { code: '11', name: 'Guanajuato' },
  { code: '12', name: 'Guerrero' },
  { code: '13', name: 'Hidalgo' },
  { code: '14', name: 'Jalisco' },
  { code: '15', name: 'Estado de México' },
  { code: '16', name: 'Michoacán' },
  { code: '17', name: 'Morelos' },
  { code: '18', name: 'Nayarit' },
  { code: '19', name: 'Nuevo León' },
  { code: '20', name: 'Oaxaca' },
  { code: '21', name: 'Puebla' },
  { code: '22', name: 'Querétaro' },
  { code: '23', name: 'Quintana Roo' },
  { code: '24', name: 'San Luis Potosí' },
  { code: '25', name: 'Sinaloa' },
  { code: '26', name: 'Sonora' },
  { code: '27', name: 'Tabasco' },
  { code: '28', name: 'Tamaulipas' },
  { code: '29', name: 'Tlaxcala' },
  { code: '30', name: 'Veracruz' },
  { code: '31', name: 'Yucatán' },
  { code: '32', name: 'Zacatecas' },
];

// Top 100+ populated cities/metro areas in Mexico with center coordinates.
// For large metros (CDMX, GDL, MTY) multiple points ensure full coverage.
export const CITY_SEARCH_POINTS = [
  // CDMX Metro Area (5 points)
  { name: 'CDMX Centro', lat: 19.4326, lng: -99.1332 },
  { name: 'CDMX Norte (Tlalnepantla)', lat: 19.5370, lng: -99.1956 },
  { name: 'CDMX Oriente (Nezahualcóyotl)', lat: 19.4007, lng: -99.0145 },
  { name: 'CDMX Sur (Xochimilco)', lat: 19.2620, lng: -99.1036 },
  { name: 'CDMX Poniente (Naucalpan)', lat: 19.4785, lng: -99.2397 },

  // Guadalajara Metro Area (3 points)
  { name: 'Guadalajara Centro', lat: 20.6597, lng: -103.3496 },
  { name: 'Guadalajara Zapopan', lat: 20.7215, lng: -103.3890 },
  { name: 'Guadalajara Tlaquepaque', lat: 20.6409, lng: -103.3127 },

  // Monterrey Metro Area (3 points)
  { name: 'Monterrey Centro', lat: 25.6866, lng: -100.3161 },
  { name: 'Monterrey San Nicolás', lat: 25.7447, lng: -100.2830 },
  { name: 'Monterrey Apodaca', lat: 25.7816, lng: -100.1884 },

  // Puebla Metro
  { name: 'Puebla Centro', lat: 19.0414, lng: -98.2063 },
  { name: 'Puebla Norte', lat: 19.1100, lng: -98.2300 },

  // Toluca Metro
  { name: 'Toluca Centro', lat: 19.2826, lng: -99.6557 },
  { name: 'Metepec', lat: 19.2553, lng: -99.6040 },

  // Tijuana Metro
  { name: 'Tijuana Centro', lat: 32.5149, lng: -117.0382 },
  { name: 'Tijuana Otay', lat: 32.5407, lng: -116.9712 },

  // León Metro
  { name: 'León Centro', lat: 21.1221, lng: -101.6859 },
  { name: 'León Norte', lat: 21.1700, lng: -101.6700 },

  // Ciudad Juárez
  { name: 'Ciudad Juárez Centro', lat: 31.6904, lng: -106.4245 },
  { name: 'Ciudad Juárez Sur', lat: 31.6200, lng: -106.3900 },

  // Rest of major cities (single point each)
  { name: 'Mérida', lat: 20.9674, lng: -89.5926 },
  { name: 'Querétaro', lat: 20.5888, lng: -100.3899 },
  { name: 'San Luis Potosí', lat: 22.1565, lng: -100.9855 },
  { name: 'Aguascalientes', lat: 21.8853, lng: -102.2916 },
  { name: 'Cancún', lat: 21.1619, lng: -86.8515 },
  { name: 'Morelia', lat: 19.7060, lng: -101.1950 },
  { name: 'Chihuahua', lat: 28.6353, lng: -106.0889 },
  { name: 'Saltillo', lat: 25.4232, lng: -100.9924 },
  { name: 'Villahermosa', lat: 17.9894, lng: -92.9475 },
  { name: 'Veracruz', lat: 19.1738, lng: -96.1342 },
  { name: 'Tuxtla Gutiérrez', lat: 16.7528, lng: -93.1152 },
  { name: 'Oaxaca de Juárez', lat: 17.0732, lng: -96.7266 },
  { name: 'Hermosillo', lat: 29.0729, lng: -110.9559 },
  { name: 'Culiacán', lat: 24.7994, lng: -107.3940 },
  { name: 'Mazatlán', lat: 23.2494, lng: -106.4111 },
  { name: 'Mexicali', lat: 32.6245, lng: -115.4523 },
  { name: 'Acapulco', lat: 16.8531, lng: -99.8237 },
  { name: 'Tampico', lat: 22.2331, lng: -97.8611 },
  { name: 'Cuernavaca', lat: 18.9242, lng: -99.2216 },
  { name: 'Pachuca', lat: 20.1011, lng: -98.7591 },
  { name: 'Reynosa', lat: 26.0508, lng: -98.2978 },
  { name: 'Tlaxcala', lat: 19.3182, lng: -98.2375 },
  { name: 'Durango', lat: 24.0277, lng: -104.6532 },
  { name: 'Irapuato', lat: 20.6768, lng: -101.3563 },
  { name: 'Celaya', lat: 20.5288, lng: -100.8155 },
  { name: 'Tepic', lat: 21.5043, lng: -104.8946 },
  { name: 'Campeche', lat: 19.8301, lng: -90.5349 },
  { name: 'Colima', lat: 19.2452, lng: -103.7241 },
  { name: 'Zacatecas', lat: 22.7709, lng: -102.5832 },
  { name: 'Chetumal', lat: 18.5001, lng: -88.2961 },
  { name: 'Xalapa', lat: 19.5438, lng: -96.9102 },
  { name: 'Chilpancingo', lat: 17.5512, lng: -99.5008 },
  { name: 'La Paz (BCS)', lat: 24.1426, lng: -110.3128 },
  { name: 'Los Mochis', lat: 25.7908, lng: -108.9864 },
  { name: 'Ensenada', lat: 31.8667, lng: -116.5964 },
  { name: 'Matamoros', lat: 25.8800, lng: -97.5044 },
  { name: 'Nuevo Laredo', lat: 27.4767, lng: -99.5167 },
  { name: 'Monclova', lat: 26.9072, lng: -101.4200 },
  { name: 'Coatzacoalcos', lat: 18.1344, lng: -94.4581 },
  { name: 'Minatitlán', lat: 17.9933, lng: -94.5514 },
  { name: 'Orizaba', lat: 18.8506, lng: -97.1000 },
  { name: 'Córdoba (Ver)', lat: 18.8833, lng: -96.9341 },
  { name: 'Poza Rica', lat: 20.5328, lng: -97.4597 },
  { name: 'Uruapan', lat: 19.4200, lng: -102.0634 },
  { name: 'Zamora', lat: 19.9833, lng: -102.2833 },
  { name: 'Salamanca', lat: 20.5731, lng: -101.1956 },
  { name: 'Ciudad Victoria', lat: 23.7369, lng: -99.1411 },
  { name: 'Ciudad Obregón', lat: 27.4827, lng: -109.9304 },
  { name: 'Nogales', lat: 31.3086, lng: -110.9425 },
  { name: 'Playa del Carmen', lat: 20.6296, lng: -87.0739 },
  { name: 'San Cristóbal de las Casas', lat: 16.7370, lng: -92.6376 },
  { name: 'Tapachula', lat: 14.9047, lng: -92.2578 },
  { name: 'Comitán', lat: 16.2510, lng: -92.1341 },
  { name: 'Tehuacán', lat: 18.4617, lng: -97.3928 },
  { name: 'San Juan del Río', lat: 20.3892, lng: -99.9956 },
  { name: 'Ciudad del Carmen', lat: 18.6539, lng: -91.8075 },
  { name: 'Piedras Negras', lat: 28.7000, lng: -100.5236 },
  { name: 'Delicias', lat: 28.1903, lng: -105.4700 },
  { name: 'Cuautla', lat: 18.8124, lng: -98.9545 },
  { name: 'Guaymas', lat: 27.9178, lng: -110.9042 },
  { name: 'Navojoa', lat: 27.0767, lng: -109.4436 },
  { name: 'Torreón', lat: 25.5428, lng: -103.4068 },
  { name: 'Fresnillo', lat: 23.1733, lng: -102.8697 },
  { name: 'Tulancingo', lat: 20.0847, lng: -98.3653 },
  { name: 'Tehuantepec', lat: 16.3261, lng: -95.2428 },
  { name: 'Puerto Vallarta', lat: 20.6534, lng: -105.2253 },
  { name: 'Manzanillo', lat: 19.1100, lng: -104.3186 },
  { name: 'San Miguel de Allende', lat: 20.9144, lng: -100.7436 },
  { name: 'Huatulco', lat: 15.7833, lng: -96.1333 },
  { name: 'Zihuatanejo', lat: 17.6417, lng: -101.5517 },
  { name: 'Tuxtepec', lat: 18.0886, lng: -96.1225 },
  { name: 'Iguala', lat: 18.3456, lng: -99.5397 },
  { name: 'Texcoco', lat: 19.5158, lng: -98.8825 },
  { name: 'Ecatepec', lat: 19.6014, lng: -99.0530 },
  { name: 'Chalco', lat: 19.2631, lng: -98.8975 },
  { name: 'Cuautitlán Izcalli', lat: 19.6472, lng: -99.2117 },
  { name: 'Atlacomulco', lat: 19.7997, lng: -99.8764 },
];

export const GOOGLE_SEARCH_RADIUS = 15000; // 15km radius per search point

export const RATE_LIMIT = {
  GOOGLE_DELAY_MS: 200,
  DENUE_DELAY_MS: 500,
};
