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

        // Проверяем, является ли это ЗИПС для потолка (ID: 201-205)
        // Также проверяем по названию на случай, если структура данных отличается
        const isZIPSCeiling = (elem.c_id === "C" && elem.id >= 201 && elem.id <= 205) ||
                              (elem.c_id === "C" && elem.title && elem.title.includes("ЗИПС"));
        
        const buttonClassName = isZIPSCeiling 
          ? "const_page const_page-zips-ceiling" 
          : "const_page";
        const buttonStyle = isZIPSCeiling 
          ? { 
              transform: 'rotate(-90deg)', 
              transformOrigin: 'center center',
              WebkitTransform: 'rotate(-90deg)',
              msTransform: 'rotate(-90deg)',
              MozTransform: 'rotate(-90deg)'
            }
          : {};

        return (
          <div key={`${elem.id}-${elem.c_id}`} className="const-item-container">
            <button
              value={elem.id}
              className={buttonClassName}
              onClick={() => onItemSelect(elem)}
              data-zips-ceiling={isZIPSCeiling ? "true" : undefined}
              style={buttonStyle}
            >
              <p>{elem.title}</p>
              {src && (
                <img 
                  src={src} 
                  alt="" 
                  className="img-icon" 
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    // Скрываем изображение при ошибке загрузки
                    e.target.style.display = 'none';
                  }}
                />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ItemsList;


