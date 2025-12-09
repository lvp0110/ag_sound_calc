import React from "react";
import { getImageUrl } from "../services/api";
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
  return (
    <div
      className="section-container"
      onClick={() => onSectionClick(section.id, subCategories)}
      style={{ cursor: "pointer" }}
    >
      <div className="section-header">
        <h2 className="section-title">
          <img
            src={getImageUrl(section.icon)}
            alt=""
            className="section-icon"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // Скрываем изображение при ошибке загрузки
              e.target.style.display = 'none';
            }}
          />
          {section.title}
        </h2>
      </div>

      {openedSubCategory && (
        <div
          className="items content-item"
          onClick={(e) => e.stopPropagation()}
        >
          <ItemsList
            items={items}
            onItemSelect={onItemSelect}
            selectedItemId={selectedItemId}
          />
        </div>
      )}

      {children && (
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      )}
    </div>
  );
};

export default SectionContainer;







