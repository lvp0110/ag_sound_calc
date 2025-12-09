import React, { useState } from "react";
import { getImageUrl, getImageUrlWithFallback } from "../services/api";

/**
 * Компонент списка элементов конструкции
 */
const ItemsList = ({ items, onItemSelect, selectedItemId }) => {
  // Состояние для отслеживания ошибок загрузки изображений
  const [imageErrors, setImageErrors] = useState(new Set());

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

  const handleImageError = (elem, imageSrc) => {
    const errorKey = `${elem.id}-${imageSrc}`;
    if (!imageErrors.has(errorKey)) {
      setImageErrors(prev => new Set([...prev, errorKey]));
      // Пробуем загрузить через прямой URL
      const fallbackUrl = getImageUrl(imageSrc, true);
      const img = new Image();
      img.onload = () => {
        // Если прямой URL работает, обновляем изображение
        const element = document.querySelector(`[data-image-key="${errorKey}"]`);
        if (element) {
          element.src = fallbackUrl;
        }
      };
      img.src = fallbackUrl;
    }
  };

  return (
    <div className="items content-item">
      {items.map((elem) => {
        const imageSrc = elem.Img || elem.img;
        const isLocalZipsCeilingImage =
          typeof imageSrc === "string" &&
          (imageSrc.startsWith("/zips_ceiling/") ||
            imageSrc.startsWith("zips_ceiling/") ||
            imageSrc.includes("ceiling_zips_"));

        const normalizeLocal = (path) => {
          if (!path) return path;
          return path.startsWith("/") ? path : `/${path}`;
        };

        const src = isLocalZipsCeilingImage
          ? normalizeLocal(imageSrc)
          : imageSrc
          ? imageSrc.startsWith("http://") || imageSrc.startsWith("https://")
            ? imageSrc
            : getImageUrlWithFallback(imageSrc)
          : null;

        // Проверяем, является ли это ЗИПС для потолка (ID: 201-205)
        // Также проверяем по названию на случай, если структура данных отличается
        const isZIPSCeiling = (elem.c_id === "C" && elem.id >= 201 && elem.id <= 205) ||
                              (elem.c_id === "C" && elem.title && elem.title.includes("ЗИПС"));
        
        const isSelected = selectedItemId === elem.id;
        const buttonClassName = [
          "const_page",
          isZIPSCeiling ? "const_page-zips-ceiling" : null,
          isSelected ? "const_page--selected" : null,
        ]
          .filter(Boolean)
          .join(" ");
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
                  data-image-key={`${elem.id}-${imageSrc}`}
                  onError={(e) => {
                    if (!isLocalZipsCeilingImage) {
                      handleImageError(elem, imageSrc);
                    }
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


