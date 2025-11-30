import React from "react";
import { getImageUrl } from "../services/api";

/**
 * Компонент списка элементов конструкции
 */
const ItemsList = ({ items, onItemSelect, selectedItemId }) => {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#878181",
        }}
      >
        Нет элементов в этой подкатегории
      </div>
    );
  }

  return (
    <div className="items content-item">
      {items.map((elem) => {
        const imageSrc = elem.Img || elem.img;
        const src =
          imageSrc &&
          (imageSrc.startsWith("http://") || imageSrc.startsWith("https://"))
            ? imageSrc
            : imageSrc
            ? getImageUrl(imageSrc)
            : null;

        return (
          <div key={`${elem.id}-${elem.c_id}`} className="const-item-container">
            <button
              value={elem.id}
              className="const_page"
              onClick={() => onItemSelect(elem)}
            >
              <p>{elem.title}</p>
              {src && <img src={src} alt="" className="img-icon" />}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ItemsList;

