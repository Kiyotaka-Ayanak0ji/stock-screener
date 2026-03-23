export interface Stock {
  ticker: string;
  name: string;
  exchange: "NSE" | "BSE";
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  marketCap: number;
  lastUpdated: Date;
  yahooSymbol?: string; // For indices/special symbols where ticker != Yahoo symbol
  isIndex?: boolean;
  screenerCode?: string; // Original Screener numeric code for valid links
}

export interface StockEvent {
  ticker: string;
  tags: string[];
}

// Screener.in ticker mapping for stocks whose URL slug differs from the trading symbol
const SCREENER_SLUG_MAP: Record<string, string> = {
  "M&M": "M%26M",
  "NAM-INDIA": "NAM-INDIA",
  "BAJAJ-AUTO": "BAJAJ-AUTO",
};

export function getStockUrl(ticker: string, _exchange: "NSE" | "BSE", screenerCode?: string): string {
  // If we have a Screener numeric code (for indices), use that
  if (screenerCode) {
    return `https://www.screener.in/company/${screenerCode}/`;
  }
  const slug = SCREENER_SLUG_MAP[ticker] || ticker;
  const encodedSlug = SCREENER_SLUG_MAP[ticker] ? slug : encodeURIComponent(ticker);
  return `https://www.screener.in/company/${encodedSlug}/`;
}

export interface StockNote {
  ticker: string;
  note: string;
}

// Market cap in Crores (approximate)
const MARKET_CAP_MAP: Record<string, number> = {
  RELIANCE: 1680000, TCS: 1400000, INFY: 650000, HDFCBANK: 1250000, ICICIBANK: 870000,
  WIPRO: 250000, SBIN: 710000, TMCV: 180000, TMPV: 170000, BHARTIARTL: 780000, SUNPHARMA: 285000,
};

function getMarketCap(ticker: string, price: number): number {
  return MARKET_CAP_MAP[ticker] || Math.round(price * (Math.random() * 5000 + 1000));
}

export const SAMPLE_STOCKS: Stock[] = [
  { ticker: "RELIANCE", name: "Reliance Industries", exchange: "NSE", price: 2487.35, previousClose: 2465.10, change: 22.25, changePercent: 0.90, high: 2501.00, low: 2460.00, open: 2470.00, volume: 8945621, marketCap: 1680000, lastUpdated: new Date() },
  { ticker: "TCS", name: "Tata Consultancy Services", exchange: "NSE", price: 3842.50, previousClose: 3870.25, change: -27.75, changePercent: -0.72, high: 3880.00, low: 3835.00, open: 3870.00, volume: 3254891, marketCap: 1400000, lastUpdated: new Date() },
  { ticker: "INFY", name: "Infosys Ltd", exchange: "NSE", price: 1567.80, previousClose: 1545.60, change: 22.20, changePercent: 1.44, high: 1575.00, low: 1540.00, open: 1548.00, volume: 6521340, marketCap: 650000, lastUpdated: new Date() },
  { ticker: "HDFCBANK", name: "HDFC Bank Ltd", exchange: "NSE", price: 1689.25, previousClose: 1695.40, change: -6.15, changePercent: -0.36, high: 1700.00, low: 1682.00, open: 1695.00, volume: 4521890, marketCap: 1250000, lastUpdated: new Date() },
  { ticker: "ICICIBANK", name: "ICICI Bank Ltd", exchange: "NSE", price: 1234.60, previousClose: 1220.35, change: 14.25, changePercent: 1.17, high: 1240.00, low: 1218.00, open: 1222.00, volume: 5678432, marketCap: 870000, lastUpdated: new Date() },
  { ticker: "WIPRO", name: "Wipro Ltd", exchange: "NSE", price: 456.30, previousClose: 462.15, change: -5.85, changePercent: -1.27, high: 465.00, low: 454.00, open: 462.00, volume: 7823456, marketCap: 250000, lastUpdated: new Date() },
  { ticker: "SBIN", name: "State Bank of India", exchange: "NSE", price: 789.45, previousClose: 782.30, change: 7.15, changePercent: 0.91, high: 795.00, low: 780.00, open: 783.00, volume: 9876543, marketCap: 710000, lastUpdated: new Date() },
  { ticker: "TMCV", name: "Tata Motors Commercial Vehicles", exchange: "NSE", price: 520.00, previousClose: 515.00, change: 5.00, changePercent: 0.97, high: 525.00, low: 512.00, open: 516.00, volume: 3200000, marketCap: 180000, lastUpdated: new Date() },
  { ticker: "TMPV", name: "Tata Motors Passenger Vehicles", exchange: "NSE", price: 430.00, previousClose: 425.00, change: 5.00, changePercent: 1.18, high: 435.00, low: 422.00, open: 426.00, volume: 2800000, marketCap: 170000, lastUpdated: new Date() },
  { ticker: "BHARTIARTL", name: "Bharti Airtel Ltd", exchange: "NSE", price: 1345.80, previousClose: 1360.00, change: -14.20, changePercent: -1.04, high: 1362.00, low: 1340.00, open: 1358.00, volume: 3456789, marketCap: 780000, lastUpdated: new Date() },
  { ticker: "SUNPHARMA", name: "Sun Pharma Industries", exchange: "NSE", price: 1178.90, previousClose: 1165.50, change: 13.40, changePercent: 1.15, high: 1185.00, low: 1162.00, open: 1168.00, volume: 2345678, marketCap: 285000, lastUpdated: new Date() },
];

export const ALL_AVAILABLE_STOCKS: { ticker: string; name: string; exchange: "NSE" | "BSE" }[] = [
  ...SAMPLE_STOCKS.map(s => ({ ticker: s.ticker, name: s.name, exchange: s.exchange })),
  // Nifty 50 & major NSE stocks
  { ticker: "ADANIENT", name: "Adani Enterprises", exchange: "NSE" },
  { ticker: "ADANIPORTS", name: "Adani Ports & SEZ", exchange: "NSE" },
  { ticker: "APOLLOHOSP", name: "Apollo Hospitals", exchange: "NSE" },
  { ticker: "ASIANPAINT", name: "Asian Paints", exchange: "NSE" },
  { ticker: "AXISBANK", name: "Axis Bank", exchange: "NSE" },
  { ticker: "BAJAJ-AUTO", name: "Bajaj Auto", exchange: "NSE" },
  { ticker: "BAJFINANCE", name: "Bajaj Finance", exchange: "NSE" },
  { ticker: "BAJAJFINSV", name: "Bajaj Finserv", exchange: "NSE" },
  { ticker: "BEL", name: "Bharat Electronics", exchange: "NSE" },
  { ticker: "BPCL", name: "Bharat Petroleum", exchange: "NSE" },
  { ticker: "BRITANNIA", name: "Britannia Industries", exchange: "NSE" },
  { ticker: "CIPLA", name: "Cipla Ltd", exchange: "NSE" },
  { ticker: "COALINDIA", name: "Coal India Ltd", exchange: "NSE" },
  { ticker: "DIVISLAB", name: "Divi's Laboratories", exchange: "NSE" },
  { ticker: "DRREDDY", name: "Dr. Reddy's Labs", exchange: "NSE" },
  { ticker: "EICHERMOT", name: "Eicher Motors", exchange: "NSE" },
  { ticker: "GRASIM", name: "Grasim Industries", exchange: "NSE" },
  { ticker: "HCLTECH", name: "HCL Technologies", exchange: "NSE" },
  { ticker: "HEROMOTOCO", name: "Hero MotoCorp", exchange: "NSE" },
  { ticker: "HINDALCO", name: "Hindalco Industries", exchange: "NSE" },
  { ticker: "HINDUNILVR", name: "Hindustan Unilever", exchange: "NSE" },
  { ticker: "ITC", name: "ITC Ltd", exchange: "NSE" },
  { ticker: "INDUSINDBK", name: "IndusInd Bank", exchange: "NSE" },
  { ticker: "JSWSTEEL", name: "JSW Steel", exchange: "NSE" },
  { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", exchange: "NSE" },
  { ticker: "LT", name: "Larsen & Toubro", exchange: "NSE" },
  { ticker: "LTIM", name: "LTIMindtree", exchange: "NSE" },
  { ticker: "M&M", name: "Mahindra & Mahindra", exchange: "NSE" },
  { ticker: "MARUTI", name: "Maruti Suzuki", exchange: "NSE" },
  { ticker: "NESTLEIND", name: "Nestle India", exchange: "NSE" },
  { ticker: "NTPC", name: "NTPC Ltd", exchange: "NSE" },
  { ticker: "ONGC", name: "Oil & Natural Gas Corp", exchange: "NSE" },
  { ticker: "POWERGRID", name: "Power Grid Corp", exchange: "NSE" },
  { ticker: "SHRIRAMFIN", name: "Shriram Finance", exchange: "NSE" },
  { ticker: "TATACONSUM", name: "Tata Consumer Products", exchange: "NSE" },
  { ticker: "TATASTEEL", name: "Tata Steel", exchange: "NSE" },
  { ticker: "TECHM", name: "Tech Mahindra", exchange: "NSE" },
  { ticker: "TITAN", name: "Titan Company", exchange: "NSE" },
  { ticker: "TRENT", name: "Trent Ltd", exchange: "NSE" },
  { ticker: "ULTRACEMCO", name: "UltraTech Cement", exchange: "NSE" },
  // Nifty Next 50
  { ticker: "ABB", name: "ABB India", exchange: "NSE" },
  { ticker: "ADANIGREEN", name: "Adani Green Energy", exchange: "NSE" },
  { ticker: "AMBUJACEM", name: "Ambuja Cements", exchange: "NSE" },
  { ticker: "ATGL", name: "Adani Total Gas", exchange: "NSE" },
  { ticker: "BANKBARODA", name: "Bank of Baroda", exchange: "NSE" },
  { ticker: "BERGEPAINT", name: "Berger Paints", exchange: "NSE" },
  { ticker: "BOSCHLTD", name: "Bosch Ltd", exchange: "NSE" },
  { ticker: "CANBK", name: "Canara Bank", exchange: "NSE" },
  { ticker: "CHOLAFIN", name: "Cholamandalam Investment", exchange: "NSE" },
  { ticker: "COLPAL", name: "Colgate-Palmolive", exchange: "NSE" },
  { ticker: "DLF", name: "DLF Ltd", exchange: "NSE" },
  { ticker: "DABUR", name: "Dabur India", exchange: "NSE" },
  { ticker: "DMART", name: "Avenue Supermarts (DMart)", exchange: "NSE" },
  { ticker: "GODREJCP", name: "Godrej Consumer Products", exchange: "NSE" },
  { ticker: "HAVELLS", name: "Havells India", exchange: "NSE" },
  { ticker: "HAL", name: "Hindustan Aeronautics", exchange: "NSE" },
  { ticker: "ICICIPRULI", name: "ICICI Prudential Life", exchange: "NSE" },
  { ticker: "ICICIGI", name: "ICICI Lombard GIC", exchange: "NSE" },
  { ticker: "IOC", name: "Indian Oil Corp", exchange: "NSE" },
  { ticker: "IRCTC", name: "IRCTC Ltd", exchange: "NSE" },
  { ticker: "IRFC", name: "Indian Railway Finance", exchange: "NSE" },
  { ticker: "INDUSTOWER", name: "Indus Towers", exchange: "NSE" },
  { ticker: "JINDALSTEL", name: "Jindal Steel & Power", exchange: "NSE" },
  { ticker: "JIOFIN", name: "Jio Financial Services", exchange: "NSE" },
  { ticker: "LICI", name: "Life Insurance Corp", exchange: "NSE" },
  { ticker: "LUPIN", name: "Lupin Ltd", exchange: "NSE" },
  { ticker: "MARICO", name: "Marico Ltd", exchange: "NSE" },
  { ticker: "MOTHERSON", name: "Samvardhana Motherson", exchange: "NSE" },
  { ticker: "NAUKRI", name: "Info Edge (Naukri)", exchange: "NSE" },
  { ticker: "PFC", name: "Power Finance Corp", exchange: "NSE" },
  { ticker: "PIDILITIND", name: "Pidilite Industries", exchange: "NSE" },
  { ticker: "PNB", name: "Punjab National Bank", exchange: "NSE" },
  { ticker: "RECLTD", name: "REC Ltd", exchange: "NSE" },
  { ticker: "SBICARD", name: "SBI Cards & Payment", exchange: "NSE" },
  { ticker: "SBILIFE", name: "SBI Life Insurance", exchange: "NSE" },
  { ticker: "SIEMENS", name: "Siemens Ltd", exchange: "NSE" },
  { ticker: "SRF", name: "SRF Ltd", exchange: "NSE" },
  { ticker: "SHREECEM", name: "Shree Cement", exchange: "NSE" },
  { ticker: "TORNTPHARM", name: "Torrent Pharmaceuticals", exchange: "NSE" },
  { ticker: "TVSMOTOR", name: "TVS Motor Company", exchange: "NSE" },
  { ticker: "UNIONBANK", name: "Union Bank of India", exchange: "NSE" },
  { ticker: "VEDL", name: "Vedanta Ltd", exchange: "NSE" },
  { ticker: "ZOMATO", name: "Zomato Ltd", exchange: "NSE" },
  { ticker: "ZYDUSLIFE", name: "Zydus Lifesciences", exchange: "NSE" },
  // Additional NSE stocks
  { ticker: "AARTI", name: "Aarti Industries", exchange: "NSE" },
  { ticker: "ACC", name: "ACC Ltd", exchange: "NSE" },
  { ticker: "ALKEM", name: "Alkem Laboratories", exchange: "NSE" },
  { ticker: "APLAPOLLO", name: "APL Apollo Tubes", exchange: "NSE" },
  { ticker: "ASTRAL", name: "Astral Ltd", exchange: "NSE" },
  { ticker: "ATUL", name: "Atul Ltd", exchange: "NSE" },
  { ticker: "AUBANK", name: "AU Small Finance Bank", exchange: "NSE" },
  { ticker: "AUROPHARMA", name: "Aurobindo Pharma", exchange: "NSE" },
  { ticker: "BALKRISIND", name: "Balkrishna Industries", exchange: "NSE" },
  { ticker: "BANDHANBNK", name: "Bandhan Bank", exchange: "NSE" },
  { ticker: "BATAINDIA", name: "Bata India", exchange: "NSE" },
  { ticker: "BHEL", name: "Bharat Heavy Electricals", exchange: "NSE" },
  { ticker: "BIOCON", name: "Biocon Ltd", exchange: "NSE" },
  { ticker: "CANFINHOME", name: "Can Fin Homes", exchange: "NSE" },
  { ticker: "CHAMBLFERT", name: "Chambal Fertilisers", exchange: "NSE" },
  { ticker: "COFORGE", name: "Coforge Ltd", exchange: "NSE" },
  { ticker: "CONCOR", name: "Container Corp of India", exchange: "NSE" },
  { ticker: "COROMANDEL", name: "Coromandel International", exchange: "NSE" },
  { ticker: "CROMPTON", name: "Crompton Greaves Consumer", exchange: "NSE" },
  { ticker: "CUMMINSIND", name: "Cummins India", exchange: "NSE" },
  { ticker: "DEEPAKNTR", name: "Deepak Nitrite", exchange: "NSE" },
  { ticker: "DELHIVERY", name: "Delhivery Ltd", exchange: "NSE" },
  { ticker: "DIXON", name: "Dixon Technologies", exchange: "NSE" },
  { ticker: "ESCORTS", name: "Escorts Kubota", exchange: "NSE" },
  { ticker: "EXIDEIND", name: "Exide Industries", exchange: "NSE" },
  { ticker: "FEDERALBNK", name: "Federal Bank", exchange: "NSE" },
  { ticker: "FORTIS", name: "Fortis Healthcare", exchange: "NSE" },
  { ticker: "GAIL", name: "GAIL India", exchange: "NSE" },
  { ticker: "GLENMARK", name: "Glenmark Pharmaceuticals", exchange: "NSE" },
  { ticker: "GMRINFRA", name: "GMR Airports Infra", exchange: "NSE" },
  { ticker: "GNFC", name: "Gujarat Narmada Valley", exchange: "NSE" },
  { ticker: "GODREJPROP", name: "Godrej Properties", exchange: "NSE" },
  { ticker: "GSPL", name: "Gujarat State Petronet", exchange: "NSE" },
  { ticker: "GUJGASLTD", name: "Gujarat Gas", exchange: "NSE" },
  { ticker: "HDFCAMC", name: "HDFC Asset Management", exchange: "NSE" },
  { ticker: "HDFCLIFE", name: "HDFC Life Insurance", exchange: "NSE" },
  { ticker: "HINDPETRO", name: "Hindustan Petroleum", exchange: "NSE" },
  { ticker: "HONAUT", name: "Honeywell Automation", exchange: "NSE" },
  { ticker: "IDFCFIRSTB", name: "IDFC First Bank", exchange: "NSE" },
  { ticker: "IEX", name: "Indian Energy Exchange", exchange: "NSE" },
  { ticker: "IPCALAB", name: "IPCA Laboratories", exchange: "NSE" },
  { ticker: "JUBLFOOD", name: "Jubilant FoodWorks", exchange: "NSE" },
  { ticker: "KANSAINER", name: "Kansai Nerolac Paints", exchange: "NSE" },
  { ticker: "LAURUSLABS", name: "Laurus Labs", exchange: "NSE" },
  { ticker: "LICHSGFIN", name: "LIC Housing Finance", exchange: "NSE" },
  { ticker: "LTTS", name: "L&T Technology Services", exchange: "NSE" },
  { ticker: "MANAPPURAM", name: "Manappuram Finance", exchange: "NSE" },
  { ticker: "MAXHEALTH", name: "Max Healthcare", exchange: "NSE" },
  { ticker: "MFSL", name: "Max Financial Services", exchange: "NSE" },
  { ticker: "METROPOLIS", name: "Metropolis Healthcare", exchange: "NSE" },
  { ticker: "MPHASIS", name: "Mphasis Ltd", exchange: "NSE" },
  { ticker: "MRF", name: "MRF Ltd", exchange: "NSE" },
  { ticker: "MUTHOOTFIN", name: "Muthoot Finance", exchange: "NSE" },
  { ticker: "NAM-INDIA", name: "Nippon Life India AMC", exchange: "NSE" },
  { ticker: "NATIONALUM", name: "National Aluminium", exchange: "NSE" },
  { ticker: "NAVINFLUOR", name: "Navin Fluorine", exchange: "NSE" },
  { ticker: "NMDC", name: "NMDC Ltd", exchange: "NSE" },
  { ticker: "OBEROIRLTY", name: "Oberoi Realty", exchange: "NSE" },
  { ticker: "OFSS", name: "Oracle Financial Services", exchange: "NSE" },
  { ticker: "PAGEIND", name: "Page Industries", exchange: "NSE" },
  { ticker: "PAYTM", name: "One97 Communications", exchange: "NSE" },
  { ticker: "PERSISTENT", name: "Persistent Systems", exchange: "NSE" },
  { ticker: "PETRONET", name: "Petronet LNG", exchange: "NSE" },
  { ticker: "POLYCAB", name: "Polycab India", exchange: "NSE" },
  { ticker: "PRESTIGE", name: "Prestige Estates", exchange: "NSE" },
  { ticker: "PVRINOX", name: "PVR INOX", exchange: "NSE" },
  { ticker: "RAJESHEXPO", name: "Rajesh Exports", exchange: "NSE" },
  { ticker: "RAMCOCEM", name: "Ramco Cements", exchange: "NSE" },
  { ticker: "RBLBANK", name: "RBL Bank", exchange: "NSE" },
  { ticker: "SAIL", name: "Steel Authority of India", exchange: "NSE" },
  { ticker: "SYNGENE", name: "Syngene International", exchange: "NSE" },
  { ticker: "TATACOMM", name: "Tata Communications", exchange: "NSE" },
  { ticker: "TATAELXSI", name: "Tata Elxsi", exchange: "NSE" },
  { ticker: "TATAPOWER", name: "Tata Power Company", exchange: "NSE" },
  { ticker: "TORNTPOWER", name: "Torrent Power", exchange: "NSE" },
  { ticker: "TTML", name: "Tata Teleservices", exchange: "NSE" },
  { ticker: "UBL", name: "United Breweries", exchange: "NSE" },
  { ticker: "ULTRACEMCO", name: "UltraTech Cement", exchange: "NSE" },
  { ticker: "UPL", name: "UPL Ltd", exchange: "NSE" },
  { ticker: "VOLTAS", name: "Voltas Ltd", exchange: "NSE" },
  { ticker: "WHIRLPOOL", name: "Whirlpool of India", exchange: "NSE" },
  { ticker: "YESBANK", name: "Yes Bank", exchange: "NSE" },
  // BSE-listed stocks
  { ticker: "ADANIPOWER", name: "Adani Power", exchange: "BSE" },
  { ticker: "BAJAJHLDNG", name: "Bajaj Holdings", exchange: "BSE" },
  { ticker: "BANKBEES", name: "Nippon India ETF Bank", exchange: "BSE" },
  { ticker: "CASTROLIND", name: "Castrol India", exchange: "BSE" },
  { ticker: "CEATLTD", name: "CEAT Ltd", exchange: "BSE" },
  { ticker: "CENTRALBK", name: "Central Bank of India", exchange: "BSE" },
  { ticker: "CUB", name: "City Union Bank", exchange: "BSE" },
  { ticker: "DCMSHRIRAM", name: "DCM Shriram", exchange: "BSE" },
  { ticker: "EIDPARRY", name: "EID Parry India", exchange: "BSE" },
  { ticker: "ELGIEQUIP", name: "Elgi Equipments", exchange: "BSE" },
  { ticker: "EMAMILTD", name: "Emami Ltd", exchange: "BSE" },
  { ticker: "FACT", name: "Fertilisers & Chemicals", exchange: "BSE" },
  { ticker: "FDC", name: "FDC Ltd", exchange: "BSE" },
  { ticker: "FINEORG", name: "Fine Organic Industries", exchange: "BSE" },
  { ticker: "GARFIBRES", name: "Garware Technical Fibres", exchange: "BSE" },
  { ticker: "GILLETTE", name: "Gillette India", exchange: "BSE" },
  { ticker: "GLAXO", name: "GlaxoSmithKline Pharma", exchange: "BSE" },
  { ticker: "GODFRYPHLP", name: "Godfrey Phillips India", exchange: "BSE" },
  { ticker: "GRINDWELL", name: "Grindwell Norton", exchange: "BSE" },
  { ticker: "GSFC", name: "Gujarat State Fertilizers", exchange: "BSE" },
  { ticker: "HATSUN", name: "Hatsun Agro Product", exchange: "BSE" },
  { ticker: "HEG", name: "HEG Ltd", exchange: "BSE" },
  { ticker: "IDBI", name: "IDBI Bank", exchange: "BSE" },
  { ticker: "INDHOTEL", name: "Indian Hotels Company", exchange: "BSE" },
  { ticker: "IRCON", name: "Ircon International", exchange: "BSE" },
  { ticker: "ITI", name: "ITI Ltd", exchange: "BSE" },
  { ticker: "JKCEMENT", name: "JK Cement", exchange: "BSE" },
  { ticker: "JKLAKSHMI", name: "JK Lakshmi Cement", exchange: "BSE" },
  { ticker: "JSWENERGY", name: "JSW Energy", exchange: "BSE" },
  { ticker: "KAJARIACER", name: "Kajaria Ceramics", exchange: "BSE" },
  { ticker: "KEC", name: "KEC International", exchange: "BSE" },
  { ticker: "KEI", name: "KEI Industries", exchange: "BSE" },
  { ticker: "KPITTECH", name: "KPIT Technologies", exchange: "BSE" },
  { ticker: "KRBL", name: "KRBL Ltd", exchange: "BSE" },
  { ticker: "LALPATHLAB", name: "Dr. Lal PathLabs", exchange: "BSE" },
  { ticker: "LINDEINDIA", name: "Linde India", exchange: "BSE" },
  { ticker: "MAHLIFE", name: "Mahindra Lifespace", exchange: "BSE" },
  { ticker: "MASFIN", name: "MAS Financial Services", exchange: "BSE" },
  { ticker: "MINDAIND", name: "Minda Industries", exchange: "BSE" },
  { ticker: "NATCOPHARM", name: "Natco Pharma", exchange: "BSE" },
  { ticker: "NIACL", name: "New India Assurance", exchange: "BSE" },
  { ticker: "NLCINDIA", name: "NLC India", exchange: "BSE" },
  { ticker: "NHPC", name: "NHPC Ltd", exchange: "BSE" },
  { ticker: "PHOENIXLTD", name: "Phoenix Mills", exchange: "BSE" },
  { ticker: "PIIND", name: "PI Industries", exchange: "BSE" },
  { ticker: "PNBHOUSING", name: "PNB Housing Finance", exchange: "BSE" },
  { ticker: "POLYMED", name: "Poly Medicure", exchange: "BSE" },
  { ticker: "RADICO", name: "Radico Khaitan", exchange: "BSE" },
  { ticker: "RVNL", name: "Rail Vikas Nigam", exchange: "BSE" },
  { ticker: "SCHAEFFLER", name: "Schaeffler India", exchange: "BSE" },
  { ticker: "SJVN", name: "SJVN Ltd", exchange: "BSE" },
  { ticker: "SOLARINDS", name: "Solar Industries", exchange: "BSE" },
  { ticker: "SONACOMS", name: "Sona BLW Precision", exchange: "BSE" },
  { ticker: "STARHEALTH", name: "Star Health Insurance", exchange: "BSE" },
  { ticker: "SUMICHEM", name: "Sumitomo Chemical India", exchange: "BSE" },
  { ticker: "SUNDARMFIN", name: "Sundaram Finance", exchange: "BSE" },
  { ticker: "SUPREMEIND", name: "Supreme Industries", exchange: "BSE" },
  { ticker: "SUVENPHAR", name: "Suven Pharmaceuticals", exchange: "BSE" },
  { ticker: "THERMAX", name: "Thermax Ltd", exchange: "BSE" },
  { ticker: "TIINDIA", name: "Tube Investments", exchange: "BSE" },
  { ticker: "TIMKEN", name: "Timken India", exchange: "BSE" },
  { ticker: "TRIDENT", name: "Trident Ltd", exchange: "BSE" },
  { ticker: "VGUARD", name: "V-Guard Industries", exchange: "BSE" },
  { ticker: "VINATIORGA", name: "Vinati Organics", exchange: "BSE" },
  { ticker: "ZEEL", name: "Zee Entertainment", exchange: "BSE" },
  { ticker: "ZENSAR", name: "Zensar Technologies", exchange: "BSE" },
];

// Simple encryption for localStorage
const ENCRYPTION_KEY = "stocktracker_v1";

export function encrypt(data: string): string {
  const encoded = btoa(
    data.split("").map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    ).join("")
  );
  return encoded;
}

export function decrypt(data: string): string {
  try {
    const decoded = atob(data);
    return decoded.split("").map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    ).join("");
  } catch {
    return "";
  }
}

export function simulatePriceUpdate(stock: Stock): Stock {
  const volatility = stock.price * 0.002;
  const change = (Math.random() - 0.48) * volatility;
  const newPrice = Math.max(1, stock.price + change);
  const totalChange = newPrice - stock.previousClose;
  const totalChangePercent = (totalChange / stock.previousClose) * 100;

  return {
    ...stock,
    price: Math.round(newPrice * 100) / 100,
    change: Math.round(totalChange * 100) / 100,
    changePercent: Math.round(totalChangePercent * 100) / 100,
    high: Math.max(stock.high, newPrice),
    low: Math.min(stock.low, newPrice),
    volume: stock.volume + Math.floor(Math.random() * 10000),
    lastUpdated: new Date(),
  };
}

export function generateStockData(
  ticker: string,
  name: string,
  exchange: "NSE" | "BSE",
  options?: { yahooSymbol?: string; isIndex?: boolean; screenerCode?: string }
): Stock {
  // Use zero/placeholder prices — cached or live data will override
  return {
    ticker,
    name,
    exchange,
    price: 0,
    previousClose: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    open: 0,
    volume: 0,
    marketCap: MARKET_CAP_MAP[ticker] || 0,
    lastUpdated: new Date(),
    ...(options?.yahooSymbol && { yahooSymbol: options.yahooSymbol }),
    ...(options?.isIndex && { isIndex: true }),
    ...(options?.screenerCode && { screenerCode: options.screenerCode }),
  };
}
