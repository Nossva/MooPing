"""Hardware catalog shown in "Comprar equipamiento" / "Ir a la tienda".
Static until there is a real store; move to a table when prices change often."""
from api.repositories.records import ProductRecord

PRODUCTS = (
    ProductRecord(
        id='kit-inicial-pro',
        name='Kit Inicial Ganadero Pro',
        subtitle='Estación Gateway Solar + 10 Collares GPS',
        badge='Recomendado para iniciar',
        items=(
            '1x Gateway LoRa Solar autónomo (3 km radio)',
            '10x Collares IoT Rugged IP68 con batería 3 años',
            '1x Antena de fibra de vidrio 5.8 dBi',
            'Acceso ilimitado a plataforma MooPing de por vida',
        ),
        price=1490,
        currency='USD',
        free_shipping=True,
    ),
    ProductRecord(
        id='collar-adicional',
        name='Collar Adicional MooPing GPS',
        subtitle='Pack de Expansión (Unidad o Lote x5)',
        badge=None,
        items=(
            'Collar IoT Rugged IP68 con batería 3 años',
            'Emparejamiento por NFC / QR',
        ),
        price=89,
        currency='USD',
        free_shipping=True,
    ),
)


def list_all():
    return list(PRODUCTS)
