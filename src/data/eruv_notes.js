/**
 * Eruv notes data — sourced from eruv.co.uk (KLBD) and edgwareeruv.org
 * Each eruv has: contact info, shul websites, WhatsApp groups, special notes
 */

export const ERUV_NOTES = {
  'Edgware Eruv Area': {
    url: 'https://www.eruv.co.uk/eruvin/',
    contact: { name: 'Edgware Eruv Committee', email: null },
    sponsorEmail: null,
    shuls: [
      { name: 'Edgware Eruv Website', url: 'https://edgwareeruv.org/' },
    ],
    whatsapp: null,
    notes: [
      'Both Edgwarebury Park and Stoneyfields Park are completely outside of the Eruv. Stonegrove Park is inside the Edgware Eruv and the park gate on Stonegrove marks the boundary between the Edgware Eruv (in the park) and the Stanmore Eruv (on Stonegrove).',
      'On Station Road Edgware, the Edgware Eruv stops before the old Post Office (just beyond the entrance to the Broadwalk carpark).',
      'The Edgware Eruv is bordered by two neighbouring Eruvin, Stanmore and Mill Hill. Where the Edgware Eruv joins one of its neighbours, one may choose to carry from one to the other.',
      'The A5, Edgware High Street (also known as Stonegrove) is always completely outside of the Edgware Eruv and all houses and buildings opening onto it are also completely outside. Note that some of Stonegrove is within the Stanmore Eruv.',
      'The pedestrian overpass on the A41 Edgware Way, just by the entrance to Edgwarebury Park, is outside of the Edgware Eruv but is within the Stanmore Eruv. Neither Green Lane nor the A41 links the Edgware Eruv to the Stanmore Eruv. The only link is via Stonegrove.',
      'Edgware/Mill Hill crossing points: A41 (Edgware Way) bridge over M1, Selvage Lane bridge over M1, M1 footbridge (between Hale Grove Gardens and Glendor Gardens), and Hale Lane mini-roundabout. Care should be taken when walking through Mill Hill towards Hendon as the middle of Bunns Lane is in neither Eruv. There is an alternative route via Woodland Way and Flower Lane.',
    ],
  },

  'Woodside Park Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/woodside-park/',
    contact: { name: 'Nechemya Abenson', email: 'NAbenson@theus.org.uk', phone: '07974 952 319' },
    sponsorEmail: 'eruv@woodsidepark.org.uk',
    shuls: [
      { name: 'Woodside Park Shul', url: 'https://www.woodsideparksynagogue.org.uk' },
      { name: 'Woodside Park Eruv Website', url: 'http://www.woodsideparkeruv.org/' },
    ],
    whatsapp: 'https://chat.whatsapp.com/GdT5EsL7WU0KxVBymXQr4V',
    notes: [],
  },

  'NW London Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/north-west-london/',
    contact: { name: 'Nechemya Abenson', email: 'NAbenson@theus.org.uk', phone: '07974 952 319' },
    sponsorEmail: 'info@nwlondoneruv.org',
    shuls: [
      { name: 'Golders Green Shul', url: 'http://www.goldersgreenshul.org.uk' },
      { name: 'Hendon United Synagogue', url: 'http://www.hendonsynagogue.com' },
      { name: 'Finchley United Synagogue', url: 'http://www.kinloss.org.uk' },
      { name: 'Norrice Lea United Synagogue', url: 'https://hgss.org.uk' },
      { name: 'Ner Yisrael', url: 'https://www.neryisrael.co.uk' },
      { name: 'Alei Tzion', url: 'http://www.aleitzion.co.uk' },
      { name: 'Toras Chaim', url: 'http://www.toraschaim.org.uk' },
      { name: 'Central Square Minyan', url: 'https://www.centralsquareminyan.org' },
    ],
    whatsapp: 'https://chat.whatsapp.com/EfuyE1RW0mnFCVk4l4ozw9',
    notes: [],
    links: [
      { name: 'Walking Route to The Royal Free Hospital (PDF)', url: 'https://www.eruv.co.uk/wp-content/uploads/2020/11/RFH-walking-route.pdf' },
    ],
  },

  'Mill Hill': {
    url: 'https://www.eruv.co.uk/eruvin/mill-hill/',
    contact: { name: 'Nechemya Abenson', email: 'NAbenson@theus.org.uk', phone: '07974 952 319' },
    sponsorEmail: 'gallickgill@gmail.com',
    shuls: [
      { name: 'Mill Hill Shul', url: 'https://www.shul.co.uk' },
    ],
    whatsapp: 'https://chat.whatsapp.com/IS9m39eU8X7LS8tKy22qAM',
    notes: [],
  },

  'Borehamwood Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/borehamwood/',
    contact: { name: 'Rabbi Edwards', email: 'rabbiedwards@theus.org.uk', phone: '07791 530 635' },
    sponsorEmail: 'info@eboreruv.org',
    shuls: [
      { name: 'Borehamwood Shul', url: 'http://www.borehamwoodshul.org' },
    ],
    whatsapp: null,
    notes: [
      'The Eruv boundary runs within Parkfields (the park between Barham Avenue and Red Road). If you expect to be walking through the park, please check the detailed map to see where the boundary is. Please note that the picnic table near the playground in the park is OUTSIDE of the Eruv.',
    ],
    links: [
      { name: 'Borehamwood Eruv FAQs', url: 'http://www.eboreruv.org/faqs.asp' },
      { name: 'Donate to the Borehamwood Eruv', url: 'http://www.eboreruv.org/donate.asp' },
    ],
  },

  'Bushey Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/bushey/',
    contact: { name: 'Rabbi Edwards', email: 'rabbiedwards@theus.org.uk', phone: '07791 530 635' },
    sponsorEmail: 'info@busheyeruv.org',
    shuls: [
      { name: 'Bushey Shul', url: 'https://www.busheyus.org' },
    ],
    whatsapp: 'https://chat.whatsapp.com/F9cRowfMjGQ44KFORhsz3X',
    notes: [
      'The new Rossway Drive estate is outside the eruv.',
    ],
  },

  'Stanmore Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/stanmore/',
    contact: { name: 'Rabbi Edwards', email: 'rabbiedwards@theus.org.uk', phone: '07791 530 635' },
    sponsorEmail: 'enquiries@stanmore-eruv.org.uk',
    shuls: [
      { name: 'Stanmore Shul', url: 'http://www.sacps.org.uk' },
    ],
    whatsapp: 'https://chat.whatsapp.com/HzfNVRIDZOG9gUTXvz9cmw',
    notes: [],
  },

  'Pinner Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/pinner/',
    contact: { name: 'Rabbi Edwards', email: 'rabbiedwards@theus.org.uk', phone: '07791 530 635' },
    sponsorEmail: 'info@pinnereruv.com',
    shuls: [
      { name: 'Pinner Shul', url: 'http://www.pinnershul.org' },
    ],
    whatsapp: 'https://chat.whatsapp.com/KRWFtOkutLJEKYQunp1IVd',
    notes: [],
  },

  'Belmont Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/belmont/',
    contact: { name: 'Rabbi Edwards', email: 'rabbiedwards@theus.org.uk', phone: '07791 530 635' },
    sponsorEmail: 'admin@belmontus.org.uk',
    shuls: [
      { name: 'Belmont Shul', url: 'https://www.belmontsynagogue.org.uk' },
    ],
    whatsapp: 'https://chat.whatsapp.com/J8K2jSoOauY9YeUROxNmw3',
    notes: [],
  },

  'Chigwell Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/chigwell/',
    contact: { name: 'Rabbi Edwards', email: 'rabbiedwards@theus.org.uk', phone: '07791 530 635' },
    sponsorEmail: null,
    shuls: [
      { name: 'Chigwell Shul', url: 'http://www.chigshul.org.uk' },
    ],
    whatsapp: 'https://chat.whatsapp.com/FJCXtVpeapgIirepAxFApO',
    notes: [],
  },

  'Brondesbury Park Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/brondesbury-park/',
    contact: { name: 'Nechemya Abenson', email: 'NAbenson@theus.org.uk', phone: '07974 952 319' },
    sponsorEmail: null,
    shuls: [
      { name: 'Brondesbury Park Shul', url: 'http://www.bpark.org' },
    ],
    whatsapp: 'https://chat.whatsapp.com/HT2N06YWROv6QR8onnghYl',
    notes: [],
  },

  "St John's Wood Eruv": {
    url: 'https://www.eruv.co.uk/eruvin/st-johns-wood/',
    contact: { name: 'Nechemya Abenson', email: 'NAbenson@theus.org.uk', phone: '07974 952 319' },
    sponsorEmail: 'info@sjweruv.com',
    shuls: [
      { name: "St John's Wood Shul", url: 'https://www.shulinthewood.com' },
    ],
    whatsapp: 'https://chat.whatsapp.com/FXug4qHzamoBS4UTgZTav0',
    notes: [],
  },

  'South Hampstead Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/south-hampstead/',
    contact: { name: 'Nechemya Abenson', email: 'NAbenson@theus.org.uk', phone: '07974 952 319' },
    sponsorEmail: 'office@southhampstead.org',
    shuls: [
      { name: 'South Hampstead Shul', url: 'https://www.southhampstead.org' },
    ],
    whatsapp: 'https://chat.whatsapp.com/Hfw69sKXrUmIOiYsIC76yu',
    notes: [],
  },

  'Barnet Eruv': {
    url: 'https://www.eruv.co.uk/eruvin/barnet/',
    contact: { name: 'Nechemya Abenson', email: 'NAbenson@theus.org.uk', phone: '07974 952 319' },
    sponsorEmail: 'BarnetEruv@BarnetSynagogue.org.uk',
    shuls: [
      { name: 'Barnet Shul', url: 'http://www.barnetsynagogue.org.uk' },
    ],
    whatsapp: 'https://chat.whatsapp.com/GTDDUnXAJ8tBMjFDzh5AQB',
    notes: [],
  },
};
