if (typeof fetchConfig === 'undefined') {
    function fetchConfig(type = 'json') {
        return {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: `application/${type}`
            }
        };
    }
}
console.log("fetchConfig is now defined in product-form.js");
if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    this.cart.renderContents(response);
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              this.cart.renderContents(response);
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Quantity script loaded");

    function handleQuantityChange(event) {
        event.preventDefault(); // Prevent form submission
        event.stopPropagation(); // Stop event from bubbling

        let button = event.currentTarget; // Get the clicked button
        console.log("🔹 Button clicked:", button.name);

        // Find the quantity input inside the closest quantity container
        let quantityInput = button.closest('.product-form__quantity')?.querySelector('input[name="quantity"]');

        if (!quantityInput) {
            console.error("❌ Quantity input not found");
            return;
        }

        let currentQuantity = parseInt(quantityInput.value, 10) || 1; // Default to 1 if NaN
        console.log("🔸 Current Quantity before click:", currentQuantity);

        // Prevent duplicate event execution
        if (button.dataset.clicked) {
            console.warn("⏳ Prevented duplicate click event");
            return;
        }
        button.dataset.clicked = true;
        setTimeout(() => delete button.dataset.clicked, 50); // Reset flag after short delay

        // Increase or decrease quantity
        if (button.name === "plus") {
            quantityInput.value = currentQuantity + 1;
        } else if (button.name === "minus" && currentQuantity > 1) {
            quantityInput.value = currentQuantity - 1;
        }

        console.log("✅ Updated Quantity:", quantityInput.value);

        // Dispatch event to trigger updates
        let eventChange = new Event('change', { bubbles: true });
        quantityInput.dispatchEvent(eventChange);
        console.log("📢 Change event dispatched");
    }

    // Attach event listeners to buttons (ensure no duplicates)
    document.querySelectorAll('.quantity__button').forEach(button => {
        button.removeEventListener('click', handleQuantityChange);
        button.addEventListener('click', handleQuantityChange);
    });

    // Ensure quantity input listens for changes
    function handleInputChange(event) {
        console.log("🔄 Quantity input changed:", event.target.value);
    }

    document.querySelectorAll('input[name="quantity"]').forEach(input => {
        input.removeEventListener('change', handleInputChange);
        input.addEventListener('change', handleInputChange);
    });
});


