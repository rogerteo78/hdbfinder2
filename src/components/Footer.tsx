import React from 'react';

export const Footer: React.FC = () => {
  const currentDate = '24 September 2026';

  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-50 py-8 px-4 text-xs text-slate-600">
      <div className="max-w-7xl mx-auto space-y-3">
        <p className="leading-relaxed">
          Contains information from Resale flat prices based on registration date from Jan-2017 onwards accessed on {currentDate} from the Housing & Development Board, which is made available under the terms of the Singapore Open Data Licence version 1.0{' '}
          <a
            href="https://data.gov.sg/open-data-licence"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 break-all"
          >
            https://data.gov.sg/open-data-licence
          </a>
          . Map data © OneMap, Singapore Land Authority. Prices shown are past transactions, not current listings or valuations. This is an SMU course project and is not affiliated with or endorsed by HDB, SLA or GovTech.
        </p>
      </div>
    </footer>
  );
};
