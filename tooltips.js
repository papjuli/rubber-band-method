
// Custom HTML tooltip logic with pointer interaction
document.addEventListener('DOMContentLoaded', () => {
  const tooltip = document.getElementById('tooltip-box');
  let hideTimeout = null;

  function showTooltip(target) {
    let contentHtml = '';
    // Prefer data-tooltip-id referencing a reusable tooltip content
    const tooltipId = target.getAttribute('data-tooltip-id');
    if (tooltipId) {
      const contentElem = document.getElementById(tooltipId);
      if (contentElem) {
        contentHtml = contentElem.innerHTML;
      }
    } else {
      // Fallback: use inline .tooltip-content
      const inlineContent = target.querySelector('.tooltip-content');
      if (inlineContent) {
        contentHtml = inlineContent.innerHTML;
      }
    }
    tooltip.innerHTML = contentHtml;
    tooltip.style.display = 'block';
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top;
    // Check if tooltip would overflow bottom of viewport
    if (rect.bottom + 5 + tooltipRect.height > window.innerHeight) {
      // Place above
      top = rect.top + window.scrollY - tooltipRect.height - 5;
    } else {
      // Place below
      top = rect.bottom + window.scrollY + 5;
    }
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  document.body.addEventListener('mouseover', function(e) {
    const target = e.target.closest('.tooltip');
    if (target) {
      clearTimeout(hideTimeout);
      showTooltip(target);
    }
  });

  document.body.addEventListener('mouseout', function(e) {
    const target = e.target.closest('.tooltip');
    if (target) {
      // Delay hiding to allow pointer to move into tooltip
      hideTimeout = setTimeout(hideTooltip, 200);
    }
  });

  tooltip.addEventListener('mouseover', function() {
    clearTimeout(hideTimeout);
  });
  tooltip.addEventListener('mouseout', function() {
    hideTimeout = setTimeout(hideTooltip, 200);
  });
});
