from api.entities import Organization


def get(organization_id):
    return Organization.objects.filter(id=organization_id).first()


def get_by_name(name):
    return Organization.objects.filter(name=name).first()


def create(name, **fields):
    return Organization.objects.create(name=name, **fields)


def update(organization, **fields):
    for name, value in fields.items():
        setattr(organization, name, value)
    organization.save(update_fields=list(fields))
    return organization


def delete(organization_id):
    """Cascades to everything the establecimiento owns (see schema.sql)."""
    Organization.objects.filter(id=organization_id).delete()
