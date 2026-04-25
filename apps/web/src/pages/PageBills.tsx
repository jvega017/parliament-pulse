import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { BILLS, DIVISIONS } from "../data/fixtures";

export function PageBills(): JSX.Element {
  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence</div>
          <h1 className="page-title">Bills intelligence</h1>
          <div className="page-sub">
            Tracks bills relevant to your watchlists. Bills ingest is not yet
            wired; deep links below open the live APH Bills Search.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            className="btn primary"
            href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="ext" size={13} /> Open APH Bills Search
          </a>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Tracked bills</h3>
            <span className="panel-kicker">Awaiting ingest</span>
          </div>
          <div className="panel-body">
            {BILLS.length === 0 ? (
              <div className="empty">
                <strong>No bills tracked yet.</strong>
                <span>
                  The bills register lights up once the APH Bills Search ingest is
                  connected. Until then, jump straight to the live source:
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                  <a
                    className="btn"
                    href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" size={13} /> Bills Search
                  </a>
                  <a
                    className="btn"
                    href="https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" size={13} /> Bills Digests
                  </a>
                  <a
                    className="btn"
                    href="https://parlinfo.aph.gov.au/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" size={13} /> ParlInfo full-text
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Recent divisions</h3>
            <span className="panel-kicker">Awaiting ingest</span>
          </div>
          <div className="panel-body">
            {DIVISIONS.length === 0 ? (
              <div className="empty">
                <strong>No division records.</strong>
                <span>
                  Division ingest from APH chamber documents is not yet wired.
                </span>
                <a
                  className="btn"
                  href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 4 }}
                >
                  <Icon name="ext" size={13} /> APH chamber documents
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
