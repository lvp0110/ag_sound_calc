import React, { useState } from "react";
import { getImageUrl } from "../services/api";
import { getResponsiveImageProps } from "../utils/responsiveImages";
import ItemsList from "./ItemsList";

/**
 * Компонент контейнера секции
 */
const SectionContainer = ({
  section,
  subCategories,
  openedSubCategory,
  items,
  onSectionClick,
  onItemSelect,
  selectedItemId,
  children,
}) => {
  const [imageError, setImageError] = useState(false);
  const isOpen = Boolean(openedSubCategory);

  const handleImageError = (e) => {
    if (!imageError) {
      setImageError(true);
      // Пробуем загрузить через прямой URL
      const fallbackUrl = getImageUrl(section.icon);
      const img = new Image();
      img.onload = () => {
        e.target.src = fallbackUrl;
      };
      img.src = fallbackUrl;
    } else {
      // Если и прямой URL не сработал, скрываем изображение
      e.target.style.display = 'none';
    }
  };

  return (
    <div
      className="section-container"
      onClick={() => onSectionClick(section.id, subCategories)}
      style={{ cursor: "pointer" }}
    >
      <div className="section-header">
        <h2 className="section-title">
          <img
            {...getResponsiveImageProps(section.icon, 'section')}
            alt=""
            className="section-icon"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
          {section.title}
        </h2>
      </div>

      <div
        className={`section-items ${isOpen ? "open" : ""}`}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!isOpen}
      >
        {isOpen && (
          <div className="items content-item">
            <ItemsList
              items={items}
              onItemSelect={onItemSelect}
              selectedItemId={selectedItemId}
            />
          </div>
        )}
      </div>

      {children && (
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      )}
    </div>
  );
};

export default SectionContainer;


