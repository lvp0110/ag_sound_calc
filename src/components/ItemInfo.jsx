import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Items, { getItemsWithApiImages } from "../data/items";
import { getImageUrl, getImageUrlWithFallback, getConstructionByCode, getConstructionProps } from "../services/api";
import { getResponsiveImageProps } from "../utils/responsiveImages";
import "./Calculator.css";

// Импортируем мапу изображений для потолков ЗИПС
const zipsCeilingApiImages = {
  201: "zips_ceiling/ceiling_zips_vector.jpg",
  202: "zips_ceiling/ceiling_zips_module.jpg",
  203: "zips_ceiling/ceiling_zips_IIIultra.jpg",
  204: "zips_ceiling/ceiling_zips_Z4.jpg",
  205: "zips_ceiling/ceiling_zips_cinema.jpg",
};

const ItemInfo = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [constructionData, setConstructionData] = useState(null);
  const [materials, setMaterials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [materialsExpanded, setMaterialsExpanded] = useState(false);

  // Загружаем данные элемента и конструкции из API
  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        // Загружаем items для получения базовой информации
        const itemsWithImages = await getItemsWithApiImages();
        const foundItem = itemsWithImages.find((item) => item.ag_id === id);
        
        if (foundItem) {
          setItem(foundItem);
          
          // Загружаем полные данные конструкции из API
          const construction = await getConstructionByCode(id);
          setConstructionData(construction);
          
          console.log('[ItemInfo] Construction data:', construction);
          console.log('[ItemInfo] Construction Code:', construction?.Code);
          console.log('[ItemInfo] Item ag_id:', id);
          
          // Загружаем материалы конструкции, используя Code из construction или ag_id из item
          const codeToUse = construction?.Code || id;
          if (codeToUse) {
            console.log('[ItemInfo] Fetching materials for code:', codeToUse);
            const props = await getConstructionProps(codeToUse);
            console.log('[ItemInfo] Props response:', props);
            
            if (props?.constr_materials) {
              console.log('[ItemInfo] Materials found:', props.constr_materials);
              console.log('[ItemInfo] Materials structure:', JSON.stringify(props.constr_materials, null, 2));
              
              // Ищем объект с type: "Materials" и извлекаем из него constr_materials
              const materialsItem = props.constr_materials.find(item => item.type === "Materials");
              console.log('[ItemInfo] Looking for Materials item, found:', materialsItem);
              
              if (materialsItem && materialsItem.constr_materials) {
                console.log('[ItemInfo] Found Materials item with constr_materials:', materialsItem.constr_materials);
                console.log('[ItemInfo] Materials array length:', materialsItem.constr_materials.length);
                console.log('[ItemInfo] First material:', materialsItem.constr_materials[0]);
                setMaterials(materialsItem.constr_materials);
              } else {
                console.log('[ItemInfo] No Materials item found in constr_materials');
                console.log('[ItemInfo] materialsItem:', materialsItem);
                setMaterials(null);
              }
            } else {
              console.log('[ItemInfo] No constr_materials in props');
              console.log('[ItemInfo] Props keys:', props ? Object.keys(props) : 'props is null');
              setMaterials(null);
            }
          } else {
            console.log('[ItemInfo] No code available to fetch materials');
          }
        }
      } catch (error) {
        console.error("Failed to load item data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="item-info-container">
        <div className="item-info-content">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="item-info-container">
        <div className="item-info-content">
          <h2>Элемент не найден</h2>
          <button
            onClick={() => navigate("/calc")}
            className="counter__button_plus"
            style={{ marginTop: "20px" }}
          >
            Вернуться к калькулятору
          </button>
        </div>
      </div>
    );
  }

  // Получаем данные из API или используем данные из item как fallback
  const data = constructionData || {};
  
  // Отладочная информация
  console.log('[ItemInfo] Render - materials state:', materials);
  console.log('[ItemInfo] Render - materials is array:', Array.isArray(materials));
  console.log('[ItemInfo] Render - materials length:', materials?.length);
  
  // Для потолков ЗИПС принудительно используем изображение из item (которое уже обработано через zipsCeilingApiImages)
  // Это важно, чтобы не подставлялись старые картинки из ответа API
  // В калькуляторе используется: const imageSrc = elem.Img || elem.img;
  const isZIPSCeiling = item.c_id === "C" && zipsCeilingApiImages[item.id];
  
  // Для потолков ЗИПС используем ТОЛЬКО item.Img (которое уже обработано правильно через enrichItemsWithImages)
  // enrichItemsWithImages устанавливает Img через getImageUrlWithFallback(zipsCeilingApiImages[item.id])
  // Для остальных элементов используем ту же логику, что и в калькуляторе: item.Img || item.img
  // НИКОГДА не используем data.Img для потолков ЗИПС, так как API может вернуть старые изображения
  let imgSrc;
  if (isZIPSCeiling) {
    // Для потолков ЗИПС используем только item.Img, который уже содержит правильный URL
    imgSrc = item.Img || item.img;
  } else {
    // Для остальных элементов используем ту же логику, что и в калькуляторе
    imgSrc = item.Img || item.img || data.Img;
  }
  const cadImgSrc = data.CadImg;
  
  const imgProps = imgSrc ? getResponsiveImageProps(imgSrc, "item") : null;
  const cadImgProps = cadImgSrc ? getResponsiveImageProps(cadImgSrc, "item") : null;

  return (
    <div className="item-info-container">
      <div className="item-info-content">
        <button
          onClick={() => navigate("/calc")}
          className="counter__button_plus"
          style={{ marginBottom: "20px" }}
        >
           ◁ Назад к калькулятору
        </button>

        <div className="item-info-header">
          <h1>{item.title}</h1>
        </div>

        <div className="item-info-layout">
          <div className="item-info-images-column">
            {/* Img */}
            {imgProps && imgProps.src && (
              <div className="item-info-image">
                <img
                  {...imgProps}
                  alt={item.title}
                  className="item-info-img"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    // Специальный fallback для zips_ceiling: пробуем без папки
                    if (
                      imgSrc &&
                      imgSrc.includes("zips_ceiling/") &&
                      !e.target.dataset.retried
                    ) {
                      const fileName = imgSrc.split("zips_ceiling/").pop();
                      if (fileName) {
                        e.target.dataset.retried = "true";
                        const fallbackProps = getResponsiveImageProps(fileName, 'item');
                        e.target.src = fallbackProps.src;
                        if (fallbackProps.srcSet) e.target.srcSet = fallbackProps.srcSet;
                        if (fallbackProps.sizes) e.target.sizes = fallbackProps.sizes;
                        return;
                      }
                    }
                    // Пробуем загрузить через прямой URL
                    if (imgSrc) {
                      const fallbackUrl = getImageUrl(imgSrc, true);
                      const img = new Image();
                      img.onload = () => {
                        e.target.src = fallbackUrl;
                      };
                      img.onerror = () => {
                        e.target.style.display = "none";
                      };
                      img.src = fallbackUrl;
                    } else {
                      e.target.style.display = "none";
                    }
                  }}
                />
              </div>
            )}

            {/* CadImg */}
            {cadImgProps && cadImgProps.src && (
              <div className="item-info-image">
                <img
                  {...cadImgProps}
                  alt={`${item.title} - CAD`}
                  className="item-info-img"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    if (cadImgSrc) {
                      const fallbackUrl = getImageUrl(cadImgSrc, true);
                      const img = new Image();
                      img.onload = () => {
                        e.target.src = fallbackUrl;
                      };
                      img.onerror = () => {
                        e.target.style.display = "none";
                      };
                      img.src = fallbackUrl;
                    } else {
                      e.target.style.display = "none";
                    }
                  }}
                />
              </div>
            )}

            {/* Список материалов */}
            {(() => {
              console.log('[ItemInfo] Rendering materials check:', {
                materials,
                isArray: Array.isArray(materials),
                length: materials?.length,
                materialsType: typeof materials
              });
              
              // materials уже содержит массив материалов из constr_materials объекта с type: "Materials"
              const materialsToDisplay = materials && Array.isArray(materials) && materials.length > 0 ? materials : null;
              
              if (materialsToDisplay && Array.isArray(materialsToDisplay) && materialsToDisplay.length > 0) {
                return (
                  <div className="item-info-materials">
                    <h3 
                      onClick={() => setMaterialsExpanded(!materialsExpanded)}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="item-info-materials-toggle"
                    >
                      Состав конструкции
                      <span className="item-info-materials-arrow">
                        {materialsExpanded ? ' ▼' : ' ▶'}
                      </span>
                    </h3>
                    {materialsExpanded && (
                      <ul className="item-info-materials-list">
                      {materialsToDisplay
                        .filter((material) => {
                          // Фильтруем только объекты с code и name (настоящие материалы)
                          return (
                            typeof material === 'object' &&
                            material !== null &&
                            (material.code || material.Code || material.name || material.Name)
                          );
                        })
                        .map((material, index) => {
                          // Материалы из constr_materials имеют структуру: {code: "...", name: "..."}
                          const name = material.name || material.Name || '';
                          
                          // Выводим только название материала
                          const displayText = name || 'Неизвестный материал';
                          
                          return (
                            <li key={index} className="item-info-material-item">
                              {displayText}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="item-info-details">
          {/* Code */}
          {data.Code && (
            <div className="item-info-section">
              <h3>Шифр конструкции</h3>
              <p>{data.Code}</p>
            </div>
          )}

          {/* Description */}
          {data.Description && (
            <div className="item-info-section">
              <h3>Название</h3>
              <p>{data.Description}</p>
            </div>
          )}

          {/* Thickness */}
          {data.Thickness && (
            <div className="item-info-section">
              <h3>Толщина, мм</h3>
              <p>{data.Thickness}</p>
            </div>
          )}

          {/* SoundIndex */}
          {data.SoundIndex && (
            <div className="item-info-section">
              <h3>Индекс звукоизоляции воздушного шума, Rw</h3>
              <p>{data.SoundIndex}</p>
            </div>
          )}

          {/* ImpactNoseIndex - только если есть и не равен 0 */}
          {data.ImpactNoseIndex !== undefined && data.ImpactNoseIndex !== null && data.ImpactNoseIndex !== 0 && (
            <div className="item-info-section">
              <h3>Индекс звукоизоляции ударного шума, Lnw</h3>
              <p>{data.ImpactNoseIndex}</p>
            </div>
          )}

          {/* Specification */}
          {data.Specification && (
            <div className="item-info-section">
              <h3>Описание</h3>
              <p>
                {data.Specification}
                <button 
                  className="our-history-button"
                  onClick={() => {
                    // Добавьте здесь обработчик клика
                    console.log('Наша история');
                  }}
                  aria-label="Наша история"
                >
                  <img 
                    src="/our-history.svg" 
                    alt="Наша история" 
                    className="our-history-svg"
                  />
                </button>
              </p>
            </div>
          )}
          </div>
        </div>

        <button
          onClick={() => navigate(`/calc/${item.ag_id}`)}
          className="counter__button_plus"
          style={{ marginTop: "30px" }}
        >
          Перейти к расчету
        </button>
      </div>
    </div>
  );
};

export default ItemInfo;

