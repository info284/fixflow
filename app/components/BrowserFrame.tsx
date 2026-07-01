export default function BrowserFrame({
children,
url,
}: {
children: React.ReactNode;
url: string;
}) {
return (
<div className="browserFrame">
<div className="browserWindow">
<div className="browserTop">
<div className="browserDots">
<span />
<span />
<span />
</div>

<div className="browserAddress">{url}</div>
</div>

<div className="browserContent">{children}</div>
</div>
</div>
);
}
