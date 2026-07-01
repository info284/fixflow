export default function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="browserFrameOuter">
      <div className="browserFrame">
        <div className="browserTop">
          <div className="browserDots">
            <span />
            <span />
            <span />
          </div>
          <div className="browserUrl">thefixflowapp.com/enquiries</div>
        </div>

        <div className="browserContent">
          {children}
        </div>
      </div>
    </div>
  );
}