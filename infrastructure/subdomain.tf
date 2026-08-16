locals {
  subdomain_label = replace(basename(dirname(path.cwd)), "-", ".")
}

resource "allinkl_dns" "subdomain" {
  zone_host   = "mahn.ke"
  record_type = "A"
  record_name = local.subdomain_label
  record_data = "88.99.215.101"
}
