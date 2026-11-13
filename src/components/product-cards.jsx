/** Cards an answer showed the customer (bouquets, products): photo, name, price, link. As in the widget. */
export function ProductCards({ card }) {
  if (card?.type !== "products" || !card.items?.length) return null;
  const price = (i) =>
    i.price == null ? "" : typeof i.price === "number" ? `${i.price.toLocaleString("ru-RU").replace(/ /g, " ")}${i.currency ? ` ${i.currency}` : ""}` : String(i.price);
  return (
    <div className="pcards">
      {card.items.map((i, n) => {
        const Tag = i.url ? "a" : "div";
        return (
          <Tag key={n} className="pcard" {...(i.url ? { href: i.url, target: "_blank", rel: "noopener noreferrer" } : {})}>
            <span className="pcard-photo">{i.image && <img src={i.image} alt="" loading="lazy" />}</span>
            <span className="pcard-body">
              <span className="pcard-title">{i.title}</span>
              {i.subtitle && <span className="pcard-sub">{i.subtitle}</span>}
              {price(i) && <span className="pcard-price">{price(i)}</span>}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
